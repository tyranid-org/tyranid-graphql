import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';


export const linkedDocumentParameters = {
  name: 'Filtering by linked doc parameter should work',
  fn: async (t: ContextualTestContext) => {

    const burritoMakers = await Tyr.byName['team'].findOne({ name: 'burritoMakers' });

    const query = `
      query userNameQuery {
        users(teamIds: ["${burritoMakers.$id}"]) {
          name
          teamIds {
            name,
            organizationId {
              name
            }
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
            'teamIds': [
              {
                'name': 'burritoMakers',
                'organizationId': {
                  'name': 'Chipotle'
                }
              },
              {
                'name': 'chipotleMarketing',
                'organizationId': {
                  'name': 'Chipotle'
                }
              }
            ]
          }
        ]
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};