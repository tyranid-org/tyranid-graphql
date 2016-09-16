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
});

test(() => {
  graphqlize(Tyr);
});