import {INestApplication} from "@nestjs/common";
import {TestingModule, Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {VersionControlModule, RepresentativeManager} from "@spica-server/versioncontrol";

import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:50050";

describe("Versioning e2e", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let rep: RepresentativeManager;

  const now = new Date();

  function getEmptyBucket() {
    return {
      title: "bucket1",
      description: "Description of bucket1",
      history: false,
      icon: "view_stream",
      properties: {
        title: {
          type: "string",
          options: {position: "bottom"}
        }
      },
      acl: {read: "true==true", write: "true==true"},
      primary: "title"
    };
  }

  function getEmptyFunction() {
    return {
      name: "fn1",
      env: {},
      language: "javascript",
      timeout: 100,
      triggers: {
        default: {
          type: "http",
          active: true,
          options: {method: "Get", path: "/test", preflight: true}
        }
      },
      memoryLimit: 100
    };
  }

  function insertBucket(bucket) {
    return req.post("/bucket", bucket).then(r => r.body);
  }

  function insertFunction(fn) {
    return req.post("/function", fn).then(r => r.body);
  }

  function insertFunctionIndex(id, index) {
    return req.post(`/function/${id}/index`, {index});
  }

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        PassportTestingModule.initialize(),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING, DATE_TIME]}),
        BucketModule.forRoot({
          hooks: false,
          history: false,
          realtime: false,
          cache: false,
          graphql: false
        }),
        FunctionModule.forRoot({
          path: os.tmpdir(),
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 20,
          corsOptions: {
            allowCredentials: true,
            allowedHeaders: ["*"],
            allowedMethods: ["*"],
            allowedOrigins: ["*"]
          },
          logExpireAfterSeconds: 60,
          entryLimit: 20,
          maxConcurrency: 1,
          debug: false,
          realtimeLogs: false
        }),
        VersionControlModule
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    rep = module.get(RepresentativeManager);

    app.useWebSocketAdapter(new WsAdapter(app));

    await app.listen(req.socket);

    jasmine.clock().mockDate(now);
  });

  afterEach(async () => {
    // we should not remove representatives directory for real cases because after some crash, we might want to start from old representatives
    // but it should be removed for tests cases in order to make tests run clearly
    await rep.rm();
    await app.close();
  });

  describe("sync", () => {
    let bucket;
    let bucketId: string;

    let fn;
    let fnId: string;

    beforeEach(async () => {
      bucket = getEmptyBucket();
      await insertBucket(bucket).then(bkt => (bucketId = bkt._id));

      fn = getEmptyFunction();
      await insertFunction(fn).then(fn => (fnId = fn._id));
      await insertFunctionIndex(fnId, "console.log()");
    });

    it("should get empty log if sync has not been performed yet", async () => {
      const res = await req.get("/versioncontrol/save");
      expect([res.statusCode, res.statusText, res.body]).toEqual([200, "OK", undefined]);
    });

    it("should sync and get last sync log", async () => {
      const res = await req.post("/versioncontrol/save");
      const expectedLastSync = {
        resources: [
          {
            module: "bucket-schema",
            insertions: [
              {
                ...bucket,
                _id: bucketId
              }
            ],
            updations: [],
            deletions: []
          },
          {
            module: "function-schema",
            insertions: [
              {
                ...fn,
                _id: fnId
              }
            ],
            updations: [],
            deletions: []
          },
          {
            module: "function-index",
            insertions: [
              {
                _id: fnId,
                index: "console.log()"
              }
            ],
            updations: [],
            deletions: []
          },
          {
            module: "function-dependency",
            insertions: [
              {
                _id: fnId,
                dependencies: {}
              }
            ],
            updations: [],
            deletions: []
          }
        ],
        date: now.toISOString()
      };

      expect([res.statusCode, res.statusText, res.body]).toEqual([
        201,
        "Created",
        expectedLastSync
      ]);

      const {body: lastSync} = await req.get("/versioncontrol/save");
      expect(lastSync).toEqual(expectedLastSync);
    });
  });

  describe("commands", () => {
    it("should get available commands", async () => {
      const res = await req.get("/versioncontrol/commands");
      expect([res.statusCode, res.statusText, res.body]).toEqual([
        200,
        "OK",
        [
          "reset",
          "add",
          "commit",
          "tag",
          "stash",
          "checkout",
          "branch",
          "fetch",
          "pull",
          "push",
          "merge",
          "rebase",
          "remote",
          "diff",
          "log"
        ]
      ]);
    });

    // it("should commit changes", async() => {
    //   await req.post();
    // });
  });
});
