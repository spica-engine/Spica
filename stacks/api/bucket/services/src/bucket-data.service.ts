import {Inject, Injectable, Optional} from "@nestjs/common";
import {BucketDocument, Bucket, LimitExceedBehaviours} from "@spica-server/bucket/services/src";
import {BaseCollection, DatabaseService, ObjectId} from "@spica-server/database";
import {BUCKET_DATA_LIMIT} from "./options";

@Injectable()
export class BucketDataService {
  constructor(
    private db: DatabaseService,
    @Optional() @Inject(BUCKET_DATA_LIMIT) private bucketDataLimit
  ) {}

  children(schema: Bucket) {
    const Collection = BaseCollection<BucketDocument>(getBucketDataCollection(schema._id));
    let options: any = {};

    if (
      schema.documentSettings &&
      schema.documentSettings.limitExceedBehaviour == LimitExceedBehaviours.PREVENT
    ) {
      options.entryLimit = schema.documentSettings.countLimit;
    }

    const collection = new Collection(this.db, options);
    if (!this.bucketDataLimit) {
      return collection;
    }

    const insertOne = collection.insertOne;
    collection.insertOne = async doc => {
      await this.validateTotalBucketDataCount(1);
      return insertOne.bind(collection)(doc);
    };

    const insertMany = collection.insertMany;
    collection.insertMany = async docs => {
      await this.validateTotalBucketDataCount(docs.length);
      return insertMany.bind(collection)(docs);
    };

    return collection;
  }

  private async validateTotalBucketDataCount(count: number) {
    const bucketNames = await this.db
      .collection("buckets")
      .find()
      .toArray()
      .then(buckets => buckets.map(b => `bucket_${b._id}`));

    let totalDocumentCount = 0;

    await Promise.all(
      bucketNames.map(name =>
        this.db
          .collection(name)
          .estimatedDocumentCount()
          .then(c => (totalDocumentCount += c))
      )
    );
    if (totalDocumentCount + count > this.bucketDataLimit) {
      throw new Error("Total bucket-data limit exceeded");
    }
  }
}

export function getBucketDataCollection(bucketId: string | ObjectId): string {
  return `bucket_${bucketId}`;
}
