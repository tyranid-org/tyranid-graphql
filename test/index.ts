import * as mongodb from 'mongodb';
import { Tyr } from 'tyranid';
import test from 'ava';

import { graphqlize } from '../src';
import { createTestData } from './data';


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

test(async () => {
  const query = `
    query IntrospectionTypeQuery {
      __schema {
        types {
          name
        }
      }
    }
  `;

  const result = await Tyr.graphql({ query });
  console.log(JSON.stringify(result, null, 2));
});


test(async () => {
  const query = `
    query userNameQuery {
      users {
        _id
        name
      }
    }
  `;

  const result = await Tyr.graphql({ query });
  console.log(JSON.stringify(result, null, 2));
});