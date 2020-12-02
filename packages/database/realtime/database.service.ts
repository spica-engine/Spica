import {Injectable} from "@nestjs/common";
import {
  ChangeStream,
  DatabaseService,
  Document,
  FilterQuery,
  ObjectId
} from "@spica-server/database";
import {Observable, Subject, Subscription} from "rxjs";
import {bufferTime, filter, share} from "rxjs/operators";
import {levenshtein} from "./levenshtein";
import {late} from "./operators";
import {ChunkKind, StreamChunk} from "./stream";

function getSortedKeys(sort: {[k: string]: -1 | 1}) {
  return Object.keys(sort);
}

function doesTheChangeAffectTheSortedCursor(
  sortedKeys: string[],
  change: {operationType: string; updateDescription: any}
): boolean {
  // If the change occurred because of an update operation, we can check if the change affects our cursor by
  // comparing the changed keys and our sorted keys
  if (change.operationType == "update") {
    // TODO: Check this for subdocument updates (optimization)
    // This check can be optimized for subdocument updates.
    // Right now it only checks the root properties.
    const changedKeys: string[] = (change.updateDescription.removedFields || []).concat(
      Object.keys(change.updateDescription.updatedFields || {})
    );
    return changedKeys.some(k => sortedKeys.indexOf(k) > -1);
  }

  return true;
}

function fetchSortedIdsOfTheCursor<T>(
  name: string,
  db: DatabaseService,
  options: FindOptions<T>
): Promise<string[]> {
  const pipeline = [];

  if (options.filter) {
    pipeline.push({
      $match: options.filter
    });
  }

  if (options.sort) {
    pipeline.push({
      $sort: options.sort
    });
  }

  if (options.skip) {
    pipeline.push({
      $skip: options.skip
    });
  }

  if (options.limit) {
    pipeline.push({
      $limit: options.limit
    });
  }

  pipeline.push({
    $project: {
      _id: 1
    }
  });

  return db
    .collection(name)
    .aggregate(pipeline)
    .toArray()
    .then(r => r.map(r => r._id.toString()));
}

function isChangeAlreadyPresentInCursor(ids: Set<string>, change: {documentKey: {_id: ObjectId}}) {
  return ids.has(change.documentKey._id.toString());
}

function generateMatchingPipeline(filter) {
  return [
    {
      $set: {
        "fullDocument.__changeStream__": "$$ROOT"
      }
    },
    {$replaceWith: "$fullDocument"},
    // TODO: reconsider this
    {$set: {_id: {$toString: "$_id"}}},
    {$match: filter},
    {$replaceWith: "$__changeStream__"}
  ];
}

@Injectable()
export class RealtimeDatabaseService {
  constructor(private database: DatabaseService) {}

  find<T extends Document = any>(
    name: string,
    options: FindOptions<T> = {}
  ): Observable<StreamChunk<T>> {
    options = options || {};

    let ids = new Set<string>();
    return new Observable<StreamChunk<T>>(observer => {
      const streams = new Set<ChangeStream>();
      const sort = new Subject<any>();
      let sortSubscription: Subscription;

      if (options.sort) {
        const sortedKeys = getSortedKeys(options.sort);

        sortSubscription = sort
          .pipe(
            filter(change => doesTheChangeAffectTheSortedCursor(sortedKeys, change)),
            bufferTime(70),
            filter(changes => changes.length > 0)
          )
          .subscribe(async events => {
            // This optimizes sorting by sending inserts in reverse order
            // if the cursor sorted by _id property.
            if (
              sortedKeys.length == 1 &&
              sortedKeys[0] == "_id" &&
              events.length > 1 &&
              options.sort._id == -1
            ) {
              events = events.reverse();
            }
            for (const change of events) {
              if (change.operationType == "insert") {
                observer.next({kind: ChunkKind.Insert, document: change.fullDocument});
                ids.add(change.documentKey._id.toString());
              }
            }

            const syncedIds = await fetchSortedIdsOfTheCursor(name, this.database, options);
            const changeSequence = levenshtein(ids, syncedIds);
            ids = new Set(syncedIds);
            observer.next({kind: ChunkKind.Order, sequence: changeSequence.sequence});
          });
      }

      if (options.filter) {
        streams.add(
          this.database
            .collection(name)
            .watch(
              [
                ...generateMatchingPipeline({
                  $nor: [options.filter]
                }),
                {$match: {$or: [{operationType: "update"}, {operationType: "replace"}]}}
              ],
              {
                fullDocument: "updateLookup"
              }
            )
            .on("change", change => {
              if (isChangeAlreadyPresentInCursor(ids, change)) {
                observer.next({
                  kind: ChunkKind.Expunge,
                  document: change.documentKey
                });
                ids.delete(change.documentKey._id.toString());
              }
            })
        );
      }

      const fetchMoreItemToFillTheCursor = () => {
        this.database
          .collection(name)
          .find(options.filter)
          .skip(options.skip ? options.skip + ids.size : ids.size)
          .limit(options.limit - ids.size)
          .on("data", data => {
            observer.next({kind: ChunkKind.Initial, document: data});
            ids.add(data._id.toString());
          });
      };

      streams.add(
        this.database
          .collection(name)

          .watch(
            options.filter
              ? generateMatchingPipeline({
                  $or: [
                    {
                      operationType: "delete"
                    },
                    {
                      $and: [
                        {operationType: "insert"},
                        {operationType: "replace"},
                        {operationType: "update"},
                        options.filter
                      ]
                    }
                  ]
                })
              : [],
            {
              fullDocument: "updateLookup"
            }
          )
          .on("change", change => {
            switch (change.operationType) {
              case "insert":
                if (options.limit && ids.size >= options.limit && !options.sort) {
                  return;
                }

                // If sorting enabled hand over the event to sort
                if (options.sort) {
                  return sort.next(change);
                }

                observer.next({kind: ChunkKind.Insert, document: change.fullDocument});
                ids.add(change.documentKey._id.toString());

                break;
              case "delete":
                if (ids.has(change.documentKey._id.toString())) {
                  observer.next({kind: ChunkKind.Delete, document: change.documentKey});
                  ids.delete(change.documentKey._id.toString());

                  if (options.limit && ids.size < options.limit) {
                    fetchMoreItemToFillTheCursor();
                  }
                }
                break;
              case "replace":
              case "update":
                if (options.sort) {
                  sort.next(change);
                }
                // prettier-ignore
                if (
                  (!options.filter && options.skip && !isChangeAlreadyPresentInCursor(ids, change)) ||
                  (options.limit && ids.size >= options.limit && !isChangeAlreadyPresentInCursor(ids, change))
                ) {
                  return;
                }

                // If the updated or replaced document is deleted immediately
                // after update/replace operation fullDocument will be empty.
                if (change.fullDocument != null) {
                  observer.next({
                    kind: change.operationType == "update" ? ChunkKind.Update : ChunkKind.Replace,
                    document: change.fullDocument
                  });
                }
                break;
              case "drop":
                ids.clear();
                observer.complete();
                break;
            }
          })
      );

      return () => {
        if (sortSubscription) {
          sortSubscription.unsubscribe();
        }
        for (const stream of streams) {
          stream.close();
        }
        ids.clear();
      };
    }).pipe(
      share(),
      late((subscriber, connect) => {
        const pipeline = [];

        if (options.filter) {
          // TODO: reconsider this
          pipeline.push({
            $set: {_id: {$toString: "$_id"}}
          });
          pipeline.push({
            $match: options.filter
          });
        }

        if (options.sort) {
          pipeline.push({
            $sort: options.sort
          });
        }

        if (options.skip) {
          pipeline.push({
            $skip: options.skip
          });
        }

        if (options.limit) {
          pipeline.push({
            $limit: options.limit
          });
        }

        const stream = this.database.collection(name).aggregate(pipeline);

        stream.on("data", data => {
          subscriber.next({kind: ChunkKind.Initial, document: data});
          ids.add(data._id.toString());
        });
        stream.on("end", () => {
          subscriber.next({kind: ChunkKind.EndOfInitial});
          connect();
        });
      })
    );
  }
}

export interface FindOptions<T> {
  filter?: FilterQuery<T>;
  sort?: {
    [index: string]: -1 | 1;
  };
  skip?: number;
  limit?: number;
}
