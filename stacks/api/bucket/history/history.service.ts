import {Injectable} from "@nestjs/common";
import {BucketDocument} from "@spica-server/bucket/services";
import {
  Collection,
  DatabaseService,
  DeleteWriteOpResultObject,
  FilterQuery,
  InsertOneWriteOpResult,
  ObjectId,
  ReadPreference
} from "@spica-server/database";
import {ChangePaths} from "./differ";
import {History} from "./interfaces";

@Injectable()
export class HistoryService {
  readonly collection: Collection<History>;
  constructor(private db: DatabaseService) {
    this.collection = this.db.collection<History>("history");
  }

  getSchema(bucketId: ObjectId) {
    return this.db.collection<any>("buckets").findOne({_id: bucketId});
  }

  getPreviousSchema(bucketId: ObjectId) {
    return this.db.collection<any>("buckets").findOne(
      {_id: bucketId},
      {
        readPreference: new ReadPreference(ReadPreference.SECONDARY_PREFERRED, [
          {
            slaveDelay: "true"
          }
        ])
      }
    );
  }

  // We can not use BucketDataService as a direct dependency
  getDocument(bucketId: ObjectId, documentId: ObjectId) {
    return this.db.collection<BucketDocument>(`bucket_${bucketId}`).findOne({_id: documentId});
  }

  getPreviousDocument(bucketId: ObjectId, documentId: ObjectId) {
    return this.db.collection(`bucket_${bucketId}`).findOne<BucketDocument>(
      {_id: documentId},
      {
        readPreference: new ReadPreference(ReadPreference.SECONDARY_PREFERRED, [
          {
            slaveDelay: "true"
          }
        ])
      }
    );
  }

  findBetweenNow(bucketId: ObjectId, documentId: ObjectId, id: ObjectId) {
    return this.collection
      .aggregate([
        {
          $match: {$and: [{bucket_id: bucketId}, {document_id: documentId}, {_id: {$gte: id}}]}
        },
        {
          $sort: {_id: -1}
        }
      ])
      .toArray();
  }

  find(filter: FilterQuery<History>) {
    return this.collection
      .aggregate([
        {
          $match: filter
        },
        {
          $project: {
            date: {$convert: {input: "$_id", to: "date"}},
            changes: {$size: "$changes"}
          }
        },
        {
          $sort: {
            _id: -1
          }
        }
      ])
      .toArray();
  }

  getHistory(filter: FilterQuery<History>): Promise<History> {
    return this.collection.findOne(filter);
  }

  async deleteHistoryAtPath(bucketId: ObjectId, path: ChangePaths) {
    const paths = path.reduce((queries, path, index) => {
      // We simply converting the positional path to match with any number
      if ((path as any) instanceof RegExp) {
        path = {$type: 16} as any;
      }
      queries[`path.${index}`] = path;
      return queries;
    }, {});
    await this.collection.updateMany(
      {bucket_id: bucketId, changes: {$elemMatch: paths}},
      {
        $pull: {
          changes: paths
        }
      }
    );
    // Clear all the history that lost it's changes due to type changes.
    return this.collection.deleteMany({changes: {$size: 0}});
  }

  deleteMany(filter: FilterQuery<History>): Promise<DeleteWriteOpResultObject> {
    return this.collection.deleteMany(filter);
  }

  async insertOne(history: History): Promise<InsertOneWriteOpResult> {
    const recordCount = await this.collection
      .find({$and: [{bucket_id: history.bucket_id}, {document_id: history.document_id}]})
      .count();

    if (recordCount >= 10) {
      await this.collection.deleteOne({
        $and: [{bucket_id: history.bucket_id}, {document_id: history.document_id}]
      });
    }

    return this.collection.insertOne({...history, _id: new ObjectId(history._id)});
  }
}
