import { ContextualTestContext } from 'ava';
import { Tyr } from 'tyranid';
import { GraphQLResult } from 'graphql';


export const enumCollection = {
  name: 'populating an enum collection should succeed',
  fn: async (t: ContextualTestContext) => {

    const ted = await Tyr.byName['user'].findOne({ name: 'ted' });

    const query = `
      query getUserById($id: [ID]) {
        user(_id: $id) {
          status {
            name
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
          'status': {
            'name': 'Active'
          }
        }
      }
    };

    t.deepEqual<GraphQLResult>(result, expected);
  }
};