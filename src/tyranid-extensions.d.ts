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

      // full options object
      (opts: TyranidGraphQlQueryOptions): Promise<GraphQLResult>;

      // just query string
      (query: string): Promise<GraphQLResult>;

      // template tag
      (queryString: TemplateStringsArray, ...interpolated: any[]): Promise<GraphQLResult>;

      schema: GraphQLSchema;
    }

    export let graphql: TyranidGraphQLFunction;
  }

}