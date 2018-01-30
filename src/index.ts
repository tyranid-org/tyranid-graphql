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
  Thunk,
  GraphQLList,
  GraphQLFieldConfigArgumentMap,
  GraphQLResolveInfo,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  isLeafType
} from 'graphql';

export type GraphQLOutputTypeMap = Map<string, GraphQLOutputType>;

function warn(message: string) {
  console.warn(`tyranid-graphql: WARNING -- ${message}`);
}

function error(message: string): never {
  throw new Error(`tyranid-graphql: ERROR -- ${message}`);
}

/**
 * adds a `graphql(query)` method to tyranid which returns
 * a promise resolving to document(s)
 */
export function graphqlize(tyr: typeof Tyr): void {
  tyr.graphql = createGraphQLFunction(createGraphQLSchema(tyr));
}

/**
 * Given a graphql schema, close over it and return a query function for use
 * by tyranid.
 */
function createGraphQLFunction(
  schema: GraphQLSchema
): Tyr.TyranidGraphQLFunction {
  function runQuery(
    q: Tyr.TyranidGraphQlQueryOptions | TemplateStringsArray | string,
    ...interpolated: any[]
  ) {
    if (typeof q === 'string' || (Array.isArray(q) && !interpolated.length)) {
      if (Array.isArray(q)) q = q[0] as string;
      return graphql(schema, q);
    } else if (Array.isArray(q)) {
      // join template literal with imputed values
      let query = '';
      for (let i = 0, l = q.length; i < l; i++) {
        query += q[i] + (i in interpolated ? interpolated[i] : '');
      }
      return graphql(schema, query);
    } else {
      const {
        query,
        auth,
        variables,
        perm = 'view'
      } = q as Tyr.TyranidGraphQlQueryOptions;

      const context = {
        auth,
        perm
      };

      return graphql(schema, query, null, context, variables);
    }
  }

  return Object.assign(runQuery.bind(Tyr), {
    schema
  }) as Tyr.TyranidGraphQLFunction;
}

export function createGraphQLSchema(tyr: typeof Tyr): GraphQLSchema {
  const typeMap: GraphQLOutputTypeMap = new Map();
  const queryFields: GraphQLFieldConfigMap<any, any> = {};

  tyr.collections.forEach(col => {
    const name = col.def.name;
    if (!col.def.fields) return error(`Collection "${name}" has no fields!`);

    const fields = createFieldThunk(col.def.fields, typeMap, `${name}_`);

    const colGraphQLType = new GraphQLObjectType({ name, fields });

    typeMap.set(name, colGraphQLType);

    // add single and array query fields for collections
    queryFields[name] = collectionFieldConfig(col, typeMap, true);

    // TODO: less hacky...
    const suffix = name[name.length - 1] === 's' ? 'es' : 's';
    queryFields[name + suffix] = collectionFieldConfig(col, typeMap, false);
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
): GraphQLFieldConfig<any, any> {
  const colGraphQLType = map.get(col.def.name);

  if (!colGraphQLType) {
    return error(`Collection "${col.def.name}" has no graphQLType definition.`);
  }

  const fields = col.def.fields;
  const isEnum = col.def.enum;

  if (!fields) {
    return error(`Collection "${col.def.name}" has no fields property.`);
  }

  const args = createArguments(fields, map);

  const queryFunction: (...args: any[]) => Promise<any> = single
    ? col.findOne.bind(col)
    : col.findAll.bind(col);

  const type = single ? colGraphQLType : new GraphQLList(colGraphQLType);

  const argParser = createArgumentParser(fields);

  return {
    args,
    type,
    resolve(parent, args, context, operation) {
      /**
       * extract query arguments and format for consumption by mongo
       */
      const query = argParser(parent, args);

      if (isEnum) {
        if (!(args && args['_id'])) {
          const ids = (col.def.values || []).map((row: any) => row['_id']);
          args = { _id: ids };
        }

        return single ? col.byId(args['_id'][0]) : col.byIds(args['_id']);
      }

      // default to full projection
      let project: any;

      /**
       * find selections for this node,
       * add to mongodb projection
       */
      if (operation) {
        project = createProjection(col, operation);
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
export function createProjection(
  col: Tyr.CollectionInstance,
  info: GraphQLResolveInfo
): any {
  const projection: any = { _id: 1 };
  const ast = info.fieldNodes[0];
  const collectionFields = col && col.def && col.def.fields;
  const selections = ast.selectionSet && ast.selectionSet.selections.slice();

  if (!collectionFields || !selections || !selections.length) return;

  let selection:
    | FieldNode
    | FragmentSpreadNode
    | InlineFragmentNode
    | undefined;
  while ((selection = selections.shift())) {
    switch (selection.kind) {
      case 'Field': {
        const graphQlField = selection as FieldNode;
        const graphQLFieldName = graphQlField.name.value;
        const tyrField = collectionFields[graphQLFieldName] as any;

        // computed property found, no projection
        if (tyrField.def && tyrField.def.get) return;

        projection[graphQLFieldName] = 1;
        break;
      }

      /**
       * For fragments, add selection set to array and continue
       */
      case 'FragmentSpread': {
        const fragmentSpread = selection as FragmentSpreadNode;
        const fragment = info.fragments[fragmentSpread.name.value];
        selections.push(...fragment.selectionSet.selections);
        break;
      }
    }
  }

  return projection;
}

/**
 * map properties of collections to argumements
 */
export function createArguments(
  fields: { [key: string]: Tyr.FieldInstance },
  map: GraphQLOutputTypeMap
) {
  const argMap: GraphQLFieldConfigArgumentMap = {};

  for (const fieldName in fields) {
    const field = fields[fieldName];
    const def = field.def;

    if (def.is && def.is !== 'object' && def.is !== 'array') {
      const fieldType = createGraphQLFieldConfig(
        field,
        map,
        fieldName,
        '',
        true
      );

      if (fieldType && isLeafType(fieldType.type)) {
        argMap[fieldName] = {
          type: new GraphQLList(fieldType.type)
        };
      }
    }

    if (def.link || (def.is === 'array' && def.of && def.of.link)) {
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
export function createArgumentParser(fields: {
  [key: string]: Tyr.FieldInstance;
}): (parent: any, args: any) => any {
  return function(parent: any, args: any) {
    if (!args) return {};

    const query: any = {};
    for (const prop in args) {
      // TODO: fix typings on tyranid
      const field = (fields[prop] as any).def as Tyr.FieldDefinition;
      if (
        field.link ||
        field.is === 'mongoid' ||
        (field.is === 'array' && field.of && field.of.link)
      ) {
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
 * Create lazy value to contain fields for a
 * particular tyranid field definition object
 */
export function createFieldThunk(
  fields: { [key: string]: Tyr.FieldInstance },
  map: GraphQLOutputTypeMap,
  path = ''
): Thunk<GraphQLFieldConfigMap<any, any>> {
  return function() {
    const fieldsObj: GraphQLFieldConfigMap<any, any> = {};

    if (!fields) return error(`No fields given to createFieldThunk!`);

    let hasFields = false;
    for (const fieldName in fields) {
      hasFields = true;
      const field = fields[fieldName];
      const fieldConfig = createGraphQLFieldConfig(
        field,
        map,
        fieldName,
        `${path}${fieldName}`,
        true
      );
      if (fieldConfig) {
        fieldsObj[fieldName] = fieldConfig;
      }
    }

    if (!hasFields)
      return error(`path "${path}" has no entries in its fields object!`);

    return fieldsObj;
  };
}

/**
 * given a field object, create an individual GraphQLType instance
 */
export function createGraphQLFieldConfig(
  field: Tyr.FieldInstance | string,
  map: GraphQLOutputTypeMap,
  fieldName: string,
  path: string,
  single: boolean
): GraphQLFieldConfig<any, any> | undefined {
  const def = typeof field === 'string' ? undefined : field.def;
  const is = typeof field === 'string' ? field : def && def.is;

  /**
   * Wrap single type in list if desired
   */
  const wrap = (type: GraphQLOutputType) =>
    single ? type : new GraphQLList(type);

  if (def && def.link) {
    const link = def.link.replace(/\?$/g, '');
    const col = Tyr.byName[link];

    if (!col) throw new Error(`No collection found for link type = ${link}`);

    const linkType = collectionFieldConfig(col, map, single);
    const colFields = col.def.fields;

    if (!colFields)
      return error(`No fields found for collection ${col.def.name}`);

    return {
      type: linkType.type,
      args: createArguments(colFields, map),
      resolve(parent, args, context, info) {
        const linkField = parent[fieldName];
        args = args || {};

        if (!linkField) return single ? null : [];

        if (!linkType.resolve) {
          return error(
            `No linkType resolve function found for collection: ${field.link}`
          );
        }

        const linkIds = [].concat(linkField);
        const linkArgs: any = {};

        if (args['_id']) {
          const argIds = (Array.isArray(args['_id'])
            ? args['_id']
            : [args['_id']]) as string[];

          const argIdSet = new Set(argIds);

          linkArgs['_id'] = linkIds.filter((id: any) =>
            argIdSet.has(id.toString())
          );
        } else {
          linkArgs['_id'] = linkIds;
        }

        return linkType.resolve(parent, linkArgs, context, info);
      }
    };
  }

  if (!is) {
    return error(`No field.is definition for "${path}"`);
  }

  switch (is) {
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
      if (typeof field === 'string') {
        warn(`Ignoring field at path "${path}" as it has no field.of property`);
        return;
      }

      if (!field.of) {
        return error(`No field.of for array field: "${path}"`);
      }

      const subtype = createGraphQLFieldConfig(
        field.of,
        map,
        fieldName,
        `${path}_`,
        false
      );

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
      if (typeof field === 'string') {
        warn(
          `Ignoring field at path "${path}" as it has no field.fields property`
        );
        return;
      }

      const fields = field.fields;

      if (!fields) {
        warn(`Ignoring object field at path "${path}" as it has no schema`);
        return;
      }

      const defFields = createFieldThunk(fields, map, `${path}_`);

      if (!defFields) {
        warn(`Ignoring object field at path "${path}" as it has no schema`);
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

    default:
      return error(`Unable to map type "${is}" for field at path "${path}"`);
  }
}
