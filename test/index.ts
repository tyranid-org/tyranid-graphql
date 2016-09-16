import * as mongodb from 'mongodb';
import { Tyr } from 'tyranid';
import test from 'ava';

import { graphqlize } from '../src';
import { createTestData } from './data';
import { GraphQLResult } from 'graphql';

test.before(async () => {
  const db = await mongodb
    .MongoClient
    .connect('mongodb://127.0.0.1:27017/tyranid_gracl_test');

  Tyr.config({
    db: db,
    validate: [
      { dir: __dirname,
        fileMatch: 'models.js' }
    ]
  });

  await createTestData();
  graphqlize(Tyr);
});


test('Populating linked docs should succeed', async (t) => {

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
          'name': 'Chipotle'
        }
      },
      {
        'name': 'noTeams',
        'organizationId': {
          'name': 'Chipotle'
        }
      }
    ]
  };


  t.deepEqual<GraphQLResult>(result, { data: expected });
});

