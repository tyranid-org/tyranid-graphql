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
  isLeafType
} from 'graphql';





export type GraphQLOutputTypeMap = Map<string, GraphQLOutputType>;






/**
 * TODO:
 *
 *   - create root query objects for each collection
 *   - create nested field objects, add to map
 *   - ensure that enum collections work
 *
 *   // later -- optimizations / bonus...
 *   - map query info to mongodb projection
 *   - pass authentication paramters to each node if _auth / _perm flags
 */







/**
 * adds a `graphql(query)` method to tyranid which returns
 * a promise resolving to document(s)
 */
export function graphqlize(tyr: typeof Tyr) {
  const schema = createGraphQLSchema(tyr.collections);

  tyr.graphql = function({ query, auth, perm = 'view' }) {
    return graphql(schema, query, null, {
      auth,
      perm,
      docCache: {}
    });
  };
}







/**
 * tyranid schema -> graphql schema
 */
export function createGraphQLSchema(collections: Tyr.TyranidCollectionList) {
  const typeMap: GraphQLOutputTypeMap = new Map();
  const queryFields: GraphQLFieldConfigMap = {};

  collections.forEach(col => {
    const name = col.def.name;
    if (!col.def.fields) throw new TypeError(`Collection "${name}" has no fields!`);

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
  // get the created graphQl type for this collection
  const colGraphQLType = map.get(col.def.name);

  if (!colGraphQLType) {
    throw new TypeError(`Collection "${col.def.name}" has no graphQLType definition.`);
  }

  /**
   * Collection query arguments,
   * currently just id(s)
   */
  const args = single
    ? {
      id: {
        type: GraphQLID
      }
    }
    : {
      ids: {
        type: new GraphQLList(GraphQLID)
      }
    };

  return {

    type: single ? colGraphQLType : new GraphQLList(colGraphQLType),
    args,

    /**
     * Resolve the query to this collection
     */
    resolve(parent, args, context) {
      console.log(`RESOLVING...`);
      console.log(JSON.stringify({parent, args, context}, null, 2));

      const query: { [key: string]: any } = {};

      if (single) {
        if (args && args['id']) {
          query['_id'] = new ObjectID(args['id']);
        }

        return col.findOne({
          query,
          auth: context && context.auth,
          perm: context && context.auth
        });
      }

      if (args && Array.isArray(args['ids'])) {
        query['_id'] = {
          $in: args['ids'].map((id: string) => new ObjectID(id))
        };
      }

      return col.findAll({
        query,
        auth: context && context.auth,
        perm: context && context.auth
      });
    }

  };
}






/**
 * Create lazy value to contain fields for a particular tyranid field definition object
 * NOTE: mutually recursive with createGraphQLFieldConfig()
 */
export function createFieldThunk(
  fields: { [key: string]: Tyr.TyranidFieldDefinition },
  map: GraphQLOutputTypeMap,
  path = ''
): GraphQLFieldConfigMapThunk {
  return function() {
    const fieldsObj: GraphQLFieldConfigMap = {};

    if (!fields) throw new TypeError(`No fields given to createFieldThunk!`);

    for (const fieldName in fields) {
      const field = fields[fieldName];
      const fieldConfig = createGraphQLFieldConfig(field, map, fieldName, `${path}${fieldName}`);
      if (fieldConfig) {
        fieldsObj[fieldName] = fieldConfig;
      }
    }

    return fieldsObj;
  };
}






/**
 * given a field object, create an individual GraphQLType instance
 * NOTE: mutually recursive with createFieldThunk()
 */
export function createGraphQLFieldConfig(
  field: Tyr.TyranidFieldDefinition,
  map: GraphQLOutputTypeMap,
  fieldName: string,
  path: string
): GraphQLFieldConfig | undefined {

  // TODO: determine why this is necessary
  if ('def' in field) {
    // grab def property on field and recast
    field = ((field as any).def as Tyr.TyranidFieldDefinition);
  }

  if (field.link) {
    const col = Tyr.byName[field.link];
    return collectionFieldConfig(col, map, true);
  }

  if (!field.is) {
    throw new TypeError(`No field.is definition for "${path}"`);
  }

  switch (field.is) {

    case 'string':
    case 'url':
    case 'email':
    case 'image':
    case 'password':
    case 'date': // TODO: create date type
    case 'uid':
      return {
        type: GraphQLString
      };

    case 'boolean':
      return {
        type: GraphQLBoolean
      };

    case 'double':
      return {
        type: GraphQLFloat
      };

    case 'integer':
      return {
        type: GraphQLInt
      };

    case 'mongoid':
      // parse / resolve to id
      return {
        type: GraphQLID
      };

    case 'array': {
      if (!field.of) {
        throw new TypeError(`No field.of for array field: "${path}"`);
      }

      const subtype = createGraphQLFieldConfig(field.of, map, fieldName, `${path}[]`);

      if (!subtype) {
        throw new TypeError(`No field.of subtype for array field: "${path}"`);
      }

      if (isLeafType(subtype.type)) {
        return {
          type: new GraphQLList(subtype.type)
        };
      } else {
        return {
          type: new GraphQLList(subtype.type),
          args: subtype.args,

          async resolve(parent, args, context, astField) {
            if (!subtype || !astField || !subtype.resolve) return [];

            const parentFieldProp = astField.fieldName;
            if (field.of && !(field.of.link)) return parentFieldProp;

            const ids = parent[parentFieldProp];

            if (!ids || !ids.length) return [];

            const result = await subtype.resolve(parent, { ids }, context, astField);

            console.log(result);

            return result;
          }

        };
      }
    }

    case 'object': {
      const fields = field.fields;

      if (!fields) {
        return;
      }

      return {
        type: new GraphQLObjectType({
          name: fieldName,
          fields: createFieldThunk(fields, map, `${path}_`)
        })
      };
    }

    default: throw new TypeError(`Unable to map type "${field.is}" to GraphQLType instance`);
  }

}