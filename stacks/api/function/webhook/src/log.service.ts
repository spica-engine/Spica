import {Injectable, Inject} from "@nestjs/common";
import {BaseCollection, DatabaseService} from "@spica-server/database";
import {Log, WEBHOOK_OPTIONS, WebhookOptions} from "./interface";

@Injectable()
export class WebhookLogService extends BaseCollection<Log>("webhook_logs") {
  constructor(db: DatabaseService, @Inject(WEBHOOK_OPTIONS) options: WebhookOptions) {
    super(db);
    this.createCollection(this._collection, {ignoreAlreadyExist: true}).then(() =>
      this.upsertTTLIndex(options.expireAfterSeconds)
    );
  }
}
