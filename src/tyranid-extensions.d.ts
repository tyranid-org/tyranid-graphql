import { Tyr } from 'tyranid';

declare module 'tyranid' {

  namespace Tyr {

    export interface TyranidGraphQlQueryOptions {
      query: string;
      auth?: Tyr.Document;
      perm?: string;
    }

    // add graphql method to tyranid module
    // TODO: should be strongly typed, returning wrapped docs!
    export function graphql(opts: TyranidGraphQlQueryOptions): Promise<any>;
  }

}