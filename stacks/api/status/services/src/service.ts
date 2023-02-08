import {BaseCollection, DatabaseService, MongoClient} from "@spica-server/database";
import {Inject, Injectable} from "@nestjs/common";
import {ApiStatus, StatusOptions, STATUS_OPTIONS} from "./interface";
import {ObjectId} from "@spica-server/database";

@Injectable()
export class StatusService extends BaseCollection<ApiStatus>("status") {
  moduleOptions: StatusOptions;
  constructor(
    db: DatabaseService,
    client: MongoClient,
    @Inject(STATUS_OPTIONS) _moduleOptions: StatusOptions
  ) {
    // this service will insert document for each request, enabling entry limit feature here will increase request-response time.
    // we will apply entry limitation from somewhere else
    super(db, client, {afterInit: () => this.upsertTTLIndex(_moduleOptions.expireAfterSeconds)});
    this.moduleOptions = _moduleOptions;
  }

  private byteToMb(bytes: number) {
    return parseFloat((bytes * Math.pow(10, -6)).toFixed(2));
  }

  async _getStatus(begin: Date, end: Date) {
    const pipeline: any[] = [
      {
        $group: {
          _id: null,
          request: {$sum: 1},
          uploaded: {$sum: "$request.size"},
          downloaded: {$sum: "$response.size"}
        }
      }
    ];

    if (this.isValidDate(begin) && this.isValidDate(end)) {
      pipeline.unshift({
        $match: {
          _id: {
            $gte: ObjectId.createFromTime(begin.getTime() / 1000),
            $lt: ObjectId.createFromTime(end.getTime() / 1000)
          }
        }
      });
    }

    const result = await super
      .aggregate<{request: number; downloaded: number; uploaded: number}>(pipeline)
      .toArray()
      .then(r => {
        return r.length ? r[0] : {request: 0, uploaded: 0, downloaded: 0};
      });
    return {
      request: {
        limit: this.moduleOptions ? this.moduleOptions.requestLimit : undefined,
        current: result.request,
        unit: "count"
      },
      uploaded: {
        current: this.byteToMb(result.uploaded),
        unit: "mb"
      },
      downloaded: {
        current: this.byteToMb(result.downloaded),
        unit: "mb"
      }
    };
  }

  private isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }
}
