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
});


test('Array of linked properties should populate', async (t) => {

  const query = `
    query userNameQuery {
      users {
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
        },
        {
          'name': 'ted',
          'teamIds': [
            {
              'name': 'cavaEngineers',
              'organizationId': {
                'name': 'Cava'
              }
            }
          ]
        },
        {
          'name': 'noTeams',
          'teamIds': []
        }
      ]
    }
  };

  t.deepEqual<GraphQLResult>(result, expected);
});


test('Filtering by id paramter should work', async(t) => {

  const ted = await Tyr.byName['user'].findOne({ name: 'ted' });

  const query = `
    query userNameQuery {
      user(id: "${ted.$id}") {
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
});