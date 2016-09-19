import { Tyr } from 'tyranid';
import { GraphQLResult, GraphQLSchema } from 'graphql';

declare module 'tyranid' {

  namespace Tyr {

    export interface TyranidGraphQlQueryOptions {
      query: string;
      variables?: { [key: string]: any },
      auth?: Tyr.Document;
      perm?: string;
    }

    export interface TyranidGraphQLFunction {
      (opts: TyranidGraphQlQueryOptions): Promise<GraphQLResult>;
      schema: GraphQLSchema;
    }

    export let graphql: TyranidGraphQLFunction;
  }

}