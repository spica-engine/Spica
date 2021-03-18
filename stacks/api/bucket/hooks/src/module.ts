import {Global, Module} from "@nestjs/common";
import {ServicesModule} from "@spica-server/bucket/services";
import {DatabaseService} from "@spica-server/database";
import {SCHEMA} from "@spica-server/function";
import {EventQueue} from "@spica-server/function/queue";
import {ENQUEUER} from "@spica-server/function/scheduler";
import {JSONSchema7} from "json-schema";
import {Observable} from "rxjs";
import {ChangeEmitter} from "./emitter";
import {ChangeEnqueuer} from "./enqueuer";
import {ChangeQueue} from "./queue";

export function createSchema(db: DatabaseService): Observable<JSONSchema7> {
  return new Observable(observer => {
    const buckets = new Map<string, string>();

    const notifyChanges = () => {
      const schema: JSONSchema7 = {
        $id: "http://spica.internal/function/enqueuer/bucket",
        type: "object",
        required: ["bucket", "type"],
        properties: {
          bucket: {
            title: "Bucket",
            type: "string",
            enum: Array.from(buckets.keys()),
            // @ts-expect-error
            viewEnum: Array.from(buckets.values())
          },

          type: {
            title: "Operation type",
            type: "string",
            enum: ["ALL", "INSERT", "UPDATE", "DELETE"]
          }
        },
        additionalProperties: false
      };
      observer.next(schema);
    };

    const stream = db.collection("buckets").watch(
      [
        {
          $match: {
            $or: [{operationType: "insert"}, {operationType: "delete"}]
          }
        }
      ],
      {fullDocument: "updateLookup"}
    );

    stream.on("change", change => {
      switch (change.operationType) {
        case "delete":
          buckets.delete(change.documentKey._id.toString());
          notifyChanges();
          break;
        case "insert":
          if (!buckets.has(change.documentKey._id.toString())) {
            buckets.set(change.documentKey._id.toString(), change.fullDocument.title);
            notifyChanges();
          }
          break;
      }
    });

    stream.on("close", () => observer.complete());

    db.collection("buckets")
      .find({})
      .toArray()
      .then(_buckets => {
        for (const bucket of _buckets) {
          buckets.set(bucket._id.toString(), bucket.title);
        }
        notifyChanges();
      });

    return () => {
      stream.close();
    };
  });
}

@Global()
@Module({
  imports: [ServicesModule],
  exports: [ENQUEUER, SCHEMA, ChangeEmitter],
  providers: [
    ChangeEmitter,
    {
      provide: ENQUEUER,
      useFactory: (changeEmitter: ChangeEmitter) => {
        return (queue: EventQueue) => {
          const changeQueue = new ChangeQueue();
          const changeEnqueuer = new ChangeEnqueuer(queue, changeQueue, changeEmitter);
          return {
            enqueuer: changeEnqueuer,
            queue: changeQueue
          };
        };
      },
      inject: [ChangeEmitter]
    },
    {
      provide: SCHEMA,
      useFactory: (db: DatabaseService) => {
        return {name: "bucket", schema: () => createSchema(db)};
      },
      inject: [DatabaseService]
    }
  ]
})
export class HookModule {}
