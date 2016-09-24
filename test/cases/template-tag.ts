import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';

export const templateTag = {
  name: 'Template tag syntax with computed properties should work',
  fn: async (t: ContextualTestContext) => {

    const orgId = 'organizationId';
    const gql = Tyr.graphql;

    const result = await gql`
      query userNameQuery {
        users {
          name
          ${orgId} {
            name
          }
        }
      }
    `;

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