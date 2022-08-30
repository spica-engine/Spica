import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {Scheduler, SchedulerModule} from "@spica-server/function/scheduler";
import {FunctionEngine} from "@spica-server/function/src/engine";
import {FunctionService} from "@spica-server/function/services";
import {INestApplication} from "@nestjs/common";
import {TargetChange, ChangeKind} from "@spica-server/function/src/change";
import {ReplicationTestingModule} from "@spica-server/replication/testing";
import {ClassCommander} from "@spica-server/replication";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:4378";

describe("Engine", () => {
  let engine: FunctionEngine;
  let subscribeSpy: jasmine.Spy;
  let unsubscribeSpy: jasmine.Spy;

  let scheduler: Scheduler;
  let database: DatabaseService;

  let module: TestingModule;
  let app: INestApplication;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ReplicationTestingModule.create(),
        SchedulerModule.forRoot({
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 60000,
          corsOptions: {
            allowedOrigins: ["*"],
            allowedMethods: ["*"],
            allowCredentials: true,
            allowedHeaders: ["*"]
          },
          maxConcurrency: 1,
          debug: false
        }),
        DatabaseTestingModule.replicaSet()
      ]
    }).compile();

    app = module.createNestApplication();

    scheduler = module.get(Scheduler);
    database = module.get(DatabaseService);

    const cmd = await module.resolve(ClassCommander);

    engine = new FunctionEngine(
      new FunctionService(database, {} as any),
      database,
      scheduler,
      {} as any,
      cmd,
      {
        root: "test_root",
        timeout: 1
      },
      undefined,
      undefined
    );

    await app.init();

    subscribeSpy = spyOn<any>(engine, "subscribe").and.returnValue(undefined);
    unsubscribeSpy = spyOn<any>(engine, "unsubscribe").and.returnValue(undefined);
  });

  afterEach(async () => {
    subscribeSpy.calls.reset();
    unsubscribeSpy.calls.reset();
    await module.close();
    return app.close();
  });

  it("should subscribe to new trigger if ChangeKind is Added", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes);
    expect(unsubscribeSpy).not.toHaveBeenCalled();
  });

  it("should unsubscribe from removed trigger if ChangeKind is Removed", () => {
    let changes: TargetChange = {
      kind: ChangeKind.Removed,
      target: {
        id: "test_id",
        handler: "test_handler"
      }
    };

    engine["categorizeChanges"]([changes]);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes);

    expect(subscribeSpy).toHaveBeenCalledTimes(0);
  });

  it("should call unsubscribe for once then call subscribe if ChangeKind is Updated", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      }
    ];

    engine["categorizeChanges"](changes);

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes[0]);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(subscribeSpy).toHaveBeenCalledWith(changes[0]);
  });

  it("should set the handler when a handler is disabled", () => {
    let changes: TargetChange[] = [
      {
        kind: ChangeKind.Updated,
        target: {
          id: "test_id",
          handler: "test_handler"
        }
      },
      {
        kind: ChangeKind.Removed,
        target: {
          id: "test_id",
          handler: "test_handler2"
        }
      }
    ];
    engine["categorizeChanges"](changes);
    expect(unsubscribeSpy).toHaveBeenCalledWith(changes[1]);
  });

  it("should create the scheduling context when subscribing", () => {
    const changes: TargetChange = {
      kind: ChangeKind.Added,
      target: {
        id: "test_id",
        handler: "test_handler",
        context: {
          env: {
            TEST: "true"
          },
          timeout: 60
        }
      },
      type: "http",
      options: {
        method: "POST",
        path: "/test"
      }
    };

    const httpEnqueuer = Array.from(scheduler.enqueuers).find(
      enqueuer => enqueuer.description.name == "http"
    );
    const httpSubscribe = spyOn(httpEnqueuer, "subscribe");
    subscribeSpy.and.callThrough();
    engine["categorizeChanges"]([changes]);
    expect(httpSubscribe.calls.mostRecent().args[0].toObject()).toEqual({
      id: "test_id",
      cwd: "test_root/test_id",
      handler: "test_handler",
      context: {
        env: [{key: "TEST", value: "true"}],
        timeout: 60
      }
    });
  });
  describe("Database Schema", () => {
    it("should get initial schema", async () => {
      await database.createCollection("functions");
      const expectedSchema: any = {
        $id: "http://spica.internal/function/enqueuer/database",
        type: "object",
        required: ["collection", "type"],
        properties: {
          collection: {
            title: "Collection Name",
            type: "string",
            //@ts-ignore
            viewEnum: ["functions"],
            enum: ["functions"],
            description: "Collection name that the event will be tracked on"
          },
          type: {
            title: "Operation type",
            description: "Operation type that must be performed in the specified collection",
            type: "string",
            enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
          }
        },
        additionalProperties: false
      };
      const schemaPromise = await engine.getSchema("database");

      expect(schemaPromise).toEqual(expectedSchema);
    }, 10000);
  });
});
