import { TestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';

export const singlePopulated = {
  name: 'Populating linked docs should succeed',
  fn: async (t: TestContext) => {

    const query = `
      query userNameQuery {
        users {
          name
          organizationId {
            name
          }
        }
      }
    `;

    const result = await Tyr.graphql({ query });

    const expected = {
      'data': {
        'users': [
          {
            'name': 'ben',
            'organizationId': {
              'name': 'Chipotle'
            }
          },
          {
            'name': 'ted',
            'organizationId': {
              'name': 'Cava'
            }
          },
          {
            'name': 'noTeams',
            'organizationId': {
              'name': 'Chipotle'
            }
          }
        ]
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};