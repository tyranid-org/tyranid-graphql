import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';

export const computedPropertyProjection = {
  name: 'Query of doc with computed property should ignore projection',
  fn: async (t: ContextualTestContext) => {

    const query = `
      query userNameQuery {
        users(name: "ben") {
          computed
        }
      }
    `;

    const result = await Tyr.graphql({ query });

    const expected = {
      'data': {
        'users': [
          {
            'computed': 'Hello ben from a computed property!'
          }
        ]
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};