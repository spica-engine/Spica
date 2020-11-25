import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {FUNCTION_LOG_OPTIONS, Log, LogOptions} from "./interface";

@Injectable()
export class LogService extends BaseCollection<Log>("function_logs") {
  constructor(db: DatabaseService, @Inject(FUNCTION_LOG_OPTIONS) options: LogOptions) {
    super(db);
    this.createCollection(this._collection).then(() =>
      this.upsertTTLIndex(options.expireAfterSeconds)
    );
  }
}
