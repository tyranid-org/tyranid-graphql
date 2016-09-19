import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';


export const variables = {
  name: 'Using a query function with variables should succeed',
  fn: async (t: ContextualTestContext) => {

    const ted = await Tyr.byName['user'].findOne({ name: 'ted' });

    const query = `
      query getUserById($id: [ID]) {
        user(_id: $id) {
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

    const result = await Tyr.graphql({
      query,
      variables: {
        id: [ted.$id]
      }
    });

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