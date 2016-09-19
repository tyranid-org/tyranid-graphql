import { Tyr } from 'tyranid';
import { ObjectID } from 'mongodb';
import {
  graphql,
  GraphQLOutputType,
  GraphQLBoolean,
  GraphQLString,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLFieldConfigMap,
  GraphQLFieldConfig,
  GraphQLFieldConfigMapThunk,
  GraphQLList,
  GraphQLFieldConfigArgumentMap,
  GraphQLResolveInfo,
  Field,
  isLeafType
} from 'graphql';

export type GraphQLOutputTypeMap = Map<string, GraphQLOutputType>;


/**
 * adds a `graphql(query)` method to tyranid which returns
 * a promise resolving to document(s)
 */
export function graphqlize(tyr: typeof Tyr) {
  const schema = createGraphQLSchema(tyr);

  tyr.graphql = <Tyr.TyranidGraphQLFunction> Object.assign(
    function ({ query, auth, variables, perm = 'view' }: Tyr.TyranidGraphQlQueryOptions) {
      const context = {
        auth,
        perm
      };

      return graphql(schema, query, null, context, variables);
    },
    { schema }
  );
}


function warn(message: string) {
  console.warn(`tyranid-graphql: WARNING -- ${message}`);
}

function error(message: string): never {
  throw new Error(`tyranid-graphql: ERROR -- ${message}`);
}


/**
 * tyranid schema -> graphql schema
 */
export function createGraphQLSchema(tyr: typeof Tyr) {
  const typeMap: GraphQLOutputTypeMap = new Map();
  const queryFields: GraphQLFieldConfigMap = {};

  tyr.collections.forEach(col => {
    const name = col.def.name;
    if (!col.def.fields) return error(`Collection "${name}" has no fields!`);

    const fields = createFieldThunk(col.def.fields, typeMap, `${name}_`);

    const colGraphQLType = new GraphQLObjectType({ name, fields });

    typeMap.set(name, colGraphQLType);

    // add single and array query fields for collections
    queryFields[name] = collectionFieldConfig(col, typeMap, true);
    queryFields[name + 's'] = collectionFieldConfig(col, typeMap, false);
  });

  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: queryFields
    })
  });
}


/**
 * Generate a field configuration object for a given tyranid collection,
 * this defines the type as well as a resolver (either single or array)
 */
export function collectionFieldConfig(
  col: Tyr.CollectionInstance,
  map: GraphQLOutputTypeMap,
  single = true
): GraphQLFieldConfig {
  const colGraphQLType = map.get(col.def.name);

  if (!colGraphQLType) {
    return error(`Collection "${col.def.name}" has no graphQLType definition.`);
  }

  const fields = col.def.fields;

  if (!fields) {
    return error(`Collection "${col.def.name}" has no fields property.`);
  }

  const args = createArguments(fields, map);

  const queryFunction: (...args: any[]) => Promise<any> =
    single
      ? col.findOne.bind(col)
      : col.findAll.bind(col);

  const type = single
    ? colGraphQLType
    : new GraphQLList(colGraphQLType);

  const argParser = createArgumentParser(fields);

  return {
    args,
    type,
    resolve(parent, args, context, operation) {
      /**
       * extract query arguments and format for consumption by mongo
       */
      const query = argParser(parent, args);

      // default to full projection
      let project: any;

      /**
       * find selections for this node,
       * add to mongodb projection
       */
      if (operation) {
        project = createProjection(operation);
      }

      return queryFunction({
        query,
        fields: project,
        auth: context && context.auth,
        perm: context && context.perm
      });
    }
  };
}


/**
 * Get the immediate child selections for
 * the current query node from the operation and create
 * a mongodb projection
 */
export function createProjection(info: GraphQLResolveInfo): any {
  // TODO: PR graphql typings to add path prop
  const path = (info as any).path as string[];

  let selections = info.operation.selectionSet.selections;
  for (const fieldName of path) {
    for (const selection of selections) {
      const field = selection as Field;
      if (fieldName === field.name.value) {
        if (field.selectionSet) {
          selections = field.selectionSet.selections;
          continue;
        }
      }
    }
  }

  if (!selections || !selections.length) return;

  const projection: any = { _id: 1 };

  for (const selection of selections) {
    const field = selection as Field;
    projection[field.name.value] = 1;
  }

  return projection;
}


/**
 * map properties of collections to argumements
 */
export function createArguments(
  fields: Tyr.TyranidFieldsObject,
  map: GraphQLOutputTypeMap
) {
  const argMap: GraphQLFieldConfigArgumentMap = {};

  for (const fieldName in fields) {
    // TODO: why do we need to grab def again?
    const field = <Tyr.TyranidFieldDefinition> (fields[fieldName] as any).def;

    if (field.is && (field.is !== 'object') && (field.is !== 'array')) {
      const fieldType = createGraphQLFieldConfig(field, map, fieldName, '', true);
      if (fieldType && isLeafType(fieldType.type)) {
        argMap[fieldName] = {
          type: new GraphQLList(fieldType.type)
        };
      };
    }

    if (field.link || (field.is === 'array' && field.of && field.of.link)) {
      argMap[fieldName] = {
        type: new GraphQLList(GraphQLID)
      };
    }

  }
  return argMap;
}


/**
 * Create a function which maps graphql arguments to a mongo query
 */
export function createArgumentParser(
  fields: Tyr.TyranidFieldsObject
): (parent: any, args: any) => any {
  return function (parent: any, args: any) {
    if (!args) return {};

    const query: any = {};
    for (const prop in args) {
      // TODO: fix typings on tyranid
      const field = <Tyr.TyranidFieldDefinition> (fields[prop] as any).def;
      if ( field.link ||
          (field.is === 'mongoid') ||
          (field.is === 'array' && field.of && field.of.link)) {
        query[prop] = {
          $in: [].concat(args[prop]).map((id: any) => new ObjectID(id))
        };
      } else {
        query[prop] = {
          $in: args[prop]
        };
      }
    }

    return query;
  };
}


/**
 * Create lazy value to contain fields for a particular tyranid field definition object
 */
export function createFieldThunk(
  fields: { [key: string]: Tyr.TyranidFieldDefinition },
  map: GraphQLOutputTypeMap,
  path = ''
): GraphQLFieldConfigMapThunk {
  return function () {
    const fieldsObj: GraphQLFieldConfigMap = {};

    if (!fields) return error(`No fields given to createFieldThunk!`);

    let hasFields = false;
    for (const fieldName in fields) {
      hasFields = true;
      const field = fields[fieldName];
      const fieldConfig = createGraphQLFieldConfig(field, map, fieldName, `${path}${fieldName}`, true);
      if (fieldConfig) {
        fieldsObj[fieldName] = fieldConfig;
      }
    }

    if (!hasFields) return error(`path "${path}" has no entries in its fields object!`);

    return fieldsObj;
  };
}


/**
 * given a field object, create an individual GraphQLType instance
 */
export function createGraphQLFieldConfig(
  field: Tyr.TyranidFieldDefinition,
  map: GraphQLOutputTypeMap,
  fieldName: string,
  path: string,
  single: boolean
): GraphQLFieldConfig | undefined {

  if (typeof field === 'string') {
    warn(`Ignoring field: "${field}" at path "${path}" as it is a string`);
    return;
  }

  // TODO: determine why this is necessary
  if ('def' in field) {
    // grab def property on field and recast
    field = ((field as any).def as Tyr.TyranidFieldDefinition);
  }

  /**
   * Wrap single type in list if desired
   */
  const wrap = (type: GraphQLOutputType) =>
    single ? type : new GraphQLList(type);


  if (field.link) {
    const col = Tyr.byName[field.link];
    const linkType = collectionFieldConfig(col, map, single);
    const colFields = col.def.fields;

    if (!colFields) return error(`No fields found for collection ${col.def.name}`);

    return {
      type: linkType.type,
      args: createArguments(colFields, map),
      resolve(parent, args, context, ast) {
        const linkField = parent[fieldName];
        args = args || {};

        if (!linkField) return single ? null : [];

        if (!linkType.resolve) {
          return error(`No linkType resolve function found for collection: ${field.link}`);
        }

        const linkIds = [].concat(linkField);
        const linkArgs: any = {};

        if (args['_id']) {
          const argIds = <string[]> (Array.isArray(args['_id'])
            ? args['_id']
            : [ args['_id'] ]);

          const argIdSet = new Set(argIds);

          linkArgs['_id'] = linkIds.filter((id: any) => argIdSet.has(id.toString()));
        } else {
          linkArgs['_id'] = linkIds;
        }

        return linkType.resolve(parent, linkArgs, context, ast);
      }
    };
  }

  if (!field.is) {
    return error(`No field.is definition for "${path}"`);
  }

  switch (field.is) {

    case 'string':
    case 'url':
    case 'email':
    case 'image':
    case 'password':
    case 'date':
    case 'uid':
      return {
        type: wrap(GraphQLString)
      };

    case 'boolean':
      return {
        type: wrap(GraphQLBoolean)
      };

    case 'double':
      return {
        type: wrap(GraphQLFloat)
      };

    case 'integer':
      return {
        type: wrap(GraphQLInt)
      };

    case 'mongoid':
      return {
        type: wrap(GraphQLID)
      };

    case 'array': {
      if (!field.of) {
        return error(`No field.of for array field: "${path}"`);
      }

      const subtype = createGraphQLFieldConfig(field.of, map, fieldName, `${path}_`, false);

      if (!subtype) {
        warn(`Ignoring field at path "${path}" as it has no field.of property`);
        return;
      }

      if (isLeafType(subtype.type)) {
        return {
          type: subtype.type
        };
      } else {
        return {
          type: subtype.type,
          args: subtype.args,
          resolve: subtype.resolve
        };
      }
    }

    case 'object': {
      const fields = field.fields;

      if (!fields) {
        warn(`Ignoring object field at path "${path}" as it has no schema`);
        return;
      }

      const defFields = createFieldThunk(fields, map, `${path}_`);

      if (!defFields) {
        warn(`Ignoring object field at path "${path}" as it has poorly defined schema`);
        return;
      }

      const type = new GraphQLObjectType({
        name: `${path}_${fieldName}`,
        fields: defFields
      });

      return {
        type: wrap(type)
      };
    }

    default: return error(
      `Unable to map type "${field.is}" for field at path "${path}" to GraphQLType instance`
    );
  }

}