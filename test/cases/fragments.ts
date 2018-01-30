import { TestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';

export const fragments = {
  name: 'Fragments should work',
  fn: async (t: TestContext) => {

    const query = `
      query userQuery {
        user(name: "ben") {
          ...userProps
        }
      }

      fragment userProps on user {
        name
        teamIds {
          name
        }
      }
    `;

    const result = await Tyr.graphql({ query });

    const expected = {
      'data': {
        'user': {
          'name': 'ben',
          'teamIds': [
            {
              'name': 'burritoMakers'
            },
            {
              'name': 'chipotleMarketing'
            }
          ]
        }
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};