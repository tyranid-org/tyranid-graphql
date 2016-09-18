import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';


export const subDocumentParameters = {
  name: 'Filtering by sub document parameter should work',
  fn: async (t: ContextualTestContext) => {

    const burritoMakers = await Tyr.byName['team'].findOne({ name: 'burritoMakers' });

    const query = `
      query userNameQuery {
        users {
          name
          teamIds(_id: "${burritoMakers.$id}") {
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
              }
            ]
          },
          {
            'name': 'ted',
            'teamIds': []
          },
          {
            'name': 'noTeams',
            'teamIds': []
          }
        ]
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};