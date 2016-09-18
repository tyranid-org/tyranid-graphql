import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';


export const parameters = {
  name: 'Filtering by id parameter should work',
  fn: async (t: ContextualTestContext) => {

    const ted = await Tyr.byName['user'].findOne({ name: 'ted' });

    const query = `
      query userNameQuery {
        user(_id: ["${ted.$id}"]) {
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
        'user': {
          'name': 'ted',
          'teamIds': [
            {
              'name': 'cavaEngineers',
              'organizationId': {
                'name': 'Cava'
              }
            }
          ]
        }
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};