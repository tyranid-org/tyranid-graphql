import { Tyr } from 'tyranid';
import { GraphQLResult, GraphQLSchema } from 'graphql';

declare module 'tyranid' {

  namespace Tyr {

    export interface TyranidGraphQlQueryOptions {
      query: string;
      auth?: Tyr.Document;
      perm?: string;
    }

    export interface TyranidGraphQLFunction {
      (opts: TyranidGraphQlQueryOptions): Promise<GraphQLResult>;
      schema: GraphQLSchema;
    }

    // add graphql method to tyranid module
    // TODO: should be strongly typed, returning wrapped docs!
    export let graphql: TyranidGraphQLFunction;
  }

}