import * as util from "util";
import {checkDocument} from "./check";
import {mongodb, _mongodb} from "./mongo";

let connection: _mongodb.MongoClient = globalThis[Symbol.for("kDatabaseDevkitConn")];

function checkEnvironment() {
  if (!process.env.RUNTIME) {
    process.emitWarning(
      `Seems like you are not under spica/functions environment.` +
        `This module is only designed to work with spica/functions.`
    );
  }

  const {
    __INTERNAL__SPICA__MONGOURL__: url,
    __INTERNAL__SPICA__MONGODBNAME__: dbName
  } = process.env;

  if (!url || !dbName) {
    throw new Error(
      `The <__INTERNAL__SPICA__MONGOURL__> or <__INTERNAL__SPICA__MONGODBNAME__> variables was not given.`
    );
  }
}

async function connect(): Promise<_mongodb.MongoClient> {
  if (!connected()) {
    connection = new mongodb.MongoClient(process.env.__INTERNAL__SPICA__MONGOURL__, {
      replicaSet: process.env.__INTERNAL__SPICA__MONGOREPL__,
      appname: `Functions on ${process.env.RUNTIME || "unknown"} runtime.`,
      useNewUrlParser: true,
      // @ts-ignore
      useUnifiedTopology: true
    });
  }
  if (!connection.isConnected()) {
    await connection.connect();
  }
  return connection;
}

export async function database(): Promise<_mongodb.Db> {
  checkEnvironment();

  const connection = (globalThis[Symbol.for("kDatabaseDevkitConn")] = await connect());

  if (!("NO_DEVKIT_DATABASE_WARNING" in process.env) && "TIMEOUT" in process.env) {
    process.emitWarning(
      `As the structure of the data in the database is subject to change in any future release, we encourage you not to interact with the database directly.\n` +
        `As an alternative, we recommend you to interact with the APIs through an API Key to do the same. \n` +
        `Set NO_DEVKIT_DATABASE_WARNING environment variable to ignore this warning.`,
      "FootgunWarning"
    );
  }

  const db = connection.db(process.env.__INTERNAL__SPICA__MONGODBNAME__);

  const collection = db.collection;

  db.collection = (...args) => {
    const coll: _mongodb.Collection = collection.call(db, ...args);
    coll.watch = util.deprecate(
      coll.watch,
      `It is not advised to use 'watch' under spica/functions environment. I hope that you know what you are doing.`
    );
    const findOne = coll.findOne;
    coll.findOne = (filter, ...args) => {
      checkDocument(filter);
      return findOne.bind(coll)(filter, ...args);
    };
    const find = coll.find;
    coll.find = (filter, ...args) => {
      checkDocument(filter);
      return find.bind(coll)(filter, ...args);
    };
    const findOneAndUpdate = coll.findOneAndUpdate;
    coll.findOneAndUpdate = (filter, update, ...args) => {
      checkDocument(filter);
      checkDocument(update);
      return findOneAndUpdate.bind(coll)(filter, update, ...args);
    };

    const findOneAndReplace = coll.findOneAndReplace;
    coll.findOneAndReplace = (filter, update, ...args) => {
      checkDocument(filter);
      checkDocument(update);
      return findOneAndReplace.bind(coll)(filter, update, ...args);
    };

    const findOneAndDelete = coll.findOneAndDelete;
    coll.findOneAndDelete = (filter, ...args) => {
      checkDocument(filter);
      return findOneAndDelete.bind(coll)(filter, ...args);
    };

    const insertOne = coll.insertOne;
    coll.insertOne = (doc, ...args) => {
      checkDocument(doc);
      return insertOne.bind(coll)(doc, ...args);
    };
    const insertMany = coll.insertMany;
    coll.insertMany = (docs, ...args) => {
      checkDocument(docs);
      return insertMany.bind(coll)(docs, ...args);
    };
    const updateOne = coll.updateOne;
    coll.updateOne = (filter, update, ...args) => {
      checkDocument(filter);
      checkDocument(update);
      return updateOne.bind(coll)(filter, update, ...args);
    };

    const updateMany = coll.updateMany;
    coll.updateMany = (filter, update, ...args) => {
      checkDocument(filter);
      checkDocument(update);
      return updateMany.bind(coll)(filter, update, ...args);
    };

    const deleteOne = coll.deleteOne;
    coll.deleteOne = (filter, ...args) => {
      checkDocument(filter);
      return deleteOne.bind(coll)(filter, ...args);
    };

    const deleteMany = coll.deleteMany;
    coll.deleteMany = (filter, ...args) => {
      checkDocument(filter);
      return deleteMany.bind(coll)(filter, ...args);
    };

    return coll;
  };

  return db;
}

export async function close(force?: boolean): Promise<void> {
  if (connection) {
    globalThis[Symbol.for("kDatabaseDevkitConn")] = undefined;
    return connection.close(force);
  }
}

export function connected() {
  return connection && connection.isConnected();
}
