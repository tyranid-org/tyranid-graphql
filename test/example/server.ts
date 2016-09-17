import { Tyr } from 'tyranid';
import * as express from 'express';
import * as mongodb from 'mongodb';
import * as bodyParser from 'body-parser';
import { apolloExpress, graphiqlExpress } from 'apollo-server';
import { createTestData } from '../data';
import { createGraphQLSchema } from '../../src/';

(async () => {
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

  const GRAPHQL_PORT = 8080;

  const graphQLServer = express();

  graphQLServer.use('/graphql', bodyParser.json(), apolloExpress({
    schema: createGraphQLSchema(Tyr)
  }));

  graphQLServer.use('/graphiql', graphiqlExpress({
    endpointURL: '/graphql',
  }));

  graphQLServer.listen(GRAPHQL_PORT, () => console.log(
    `GraphQL Server is now running on http://localhost:${GRAPHQL_PORT}/graphiql`
  ));

})().catch(err => console.log(err.stack));
