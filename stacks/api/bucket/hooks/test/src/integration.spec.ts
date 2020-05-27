import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket";
import {Bucket, BucketDocument} from "@spica-server/bucket/services";
import {Middlewares} from "@spica-server/core";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {FunctionModule} from "@spica-server/function";
import {Function} from "@spica-server/function/src/interface";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import * as os from "os";

process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:7681";

describe("Hooks Integration", () => {
  let app: INestApplication;
  let req: Request;
  let wsc: Websocket;
  let module: TestingModule;

  let headers = {Authorization: "MY_SECRET_TOKEN"};

  let bucket: Bucket;
  let user1: BucketDocument;
  let user2: BucketDocument;

  let fn: Function;

  function updateIndex(index: string) {
    return req.post(`/function/${fn._id}/index`, {index}, headers);
  }

  beforeAll(async () => {
    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });

    module = await Test.createTestingModule({
      imports: [
        PassportTestingModule.initialize({
          overriddenStrategyType: "APIKEY"
        }),
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        BucketModule.forRoot({hooks: true, history: false, realtime: true}),
        FunctionModule.forRoot({
          path: os.tmpdir(),
          databaseName: undefined,
          poolSize: 1,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          publicUrl: undefined
        })
      ]
    }).compile();

    req = module.get(Request);
    wsc = module.get(Websocket);

    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.use(Middlewares.MergePatchJsonParser);

    await app.listen(req.socket);

    bucket = await req
      .post(
        "/bucket",
        {
          title: "New Bucket",
          description: "Describe your new bucket",
          primary: "title",
          properties: {
            username: {
              type: "string",
              options: {position: "left"}
            },
            password: {
              type: "string",
              options: {position: "right"}
            },
            age: {
              type: "number",
              options: {position: "right"}
            }
          }
        },
        headers
      )
      .then(res => res.body);

    fn = await req
      .post(
        "/function",
        {
          name: "test",
          description: "test",
          triggers: {
            get: {
              options: {
                bucket: bucket._id,
                type: "GET"
              },
              type: "bucket",
              active: true
            },
            index: {
              options: {
                bucket: bucket._id,
                type: "INDEX"
              },
              type: "bucket",
              active: true
            },
            update: {
              options: {
                bucket: bucket._id,
                type: "UPDATE"
              },
              type: "bucket",
              active: true
            },
            insert: {
              options: {
                bucket: bucket._id,
                type: "INSERT"
              },
              type: "bucket",
              active: true
            },
            stream: {
              options: {
                bucket: bucket._id,
                type: "STREAM"
              },
              type: "bucket",
              active: true
            }
          },
          env: {}
        },
        headers
      )
      .then(res => res.body);
  }, 20000);

  afterAll(() => app.close());

  beforeEach(async () => {
    await updateIndex(`
    export function insert(){
      return true;
    }
    `);
    user1 = await req
      .post(
        `/bucket/${bucket._id}/data`,
        {username: "test_user1", password: "test_password1", age: 30},
        headers
      )
      .then(res => res.body);

    user2 = await req
      .post(
        `/bucket/${bucket._id}/data`,
        {username: "test_user2", password: "test_password2", age: 19},
        headers
      )
      .then(res => res.body);
  });

  afterEach(() => req.delete(`/bucket/${bucket._id}/data`, [user1._id, user2._id], headers));

  describe("GET", () => {
    it("should not change the behaviour of bucket-data endpoint", async () => {
      await updateIndex(`export function get(){
        return [];
      }`);
      const {body: document} = await req.get(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {},
        headers
      );
      expect(document).toEqual({
        _id: "__skip__",
        username: "test_user1",
        password: "test_password1",
        age: 30
      });
    });

    it("should hide password field of bucket-data for specific apikey", async () => {
      await updateIndex(`export function get(req){
        const aggregation = [];
        
        if(req.headers.authorization == 'MY_SECRET_TOKEN' ){
          aggregation.push( { $unset: ["password"] } )
        }
        return aggregation;
      }`);
      const {body: document} = await req.get(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {},
        headers
      );
      expect(document).toEqual({_id: "__skip__", username: "test_user1", age: 30});
    });
  });

  describe("INDEX", () => {
    it("should not change the behaviour of bucket-data endpoint", async () => {
      await updateIndex(`export function index(request){
        return [];
      }`);
      const {body: document} = await req.get(`/bucket/${bucket._id}/data`, {}, headers);

      expect(document).toEqual([
        {_id: "__skip__", username: "test_user1", password: "test_password1", age: 30},
        {_id: "__skip__", username: "test_user2", password: "test_password2", age: 19}
      ]);
    });

    it("should filter users", async () => {
      await updateIndex(`export function index(request){
        return [ { $match: { age: { $lt: 20 } } } ]
      }`);
      const {body: document} = await req.get(`/bucket/${bucket._id}/data`, {}, headers);
      expect(document).toEqual([
        {_id: "__skip__", username: "test_user2", password: "test_password2", age: 19}
      ]);
    });
  });

  describe("UPDATE", () => {
    beforeEach(async () => {
      await updateIndex(`export function update(req){ return req.document != '${user1._id}' }`);
    });
    it("should not allow to update to the user1's data", async () => {
      const response = await req.put(
        `/bucket/${bucket._id}/data/${user1._id}`,
        {username: "new_username", password: "new_password", age: 10},
        headers
      );
      expect([response.statusCode, response.statusText]).toEqual([403, "Forbidden"]);
    });

    it("should allow to update to the user2's data", async () => {
      const {body: user} = await req.put(
        `/bucket/${bucket._id}/data/${user2._id}`,
        {username: "new_username", password: "new_password", age: 10},
        headers
      );
      expect(user).toEqual({
        _id: "__skip__",
        username: "new_username",
        password: "new_password",
        age: 10
      });
    });
  });

  describe("INSERT", () => {
    it("should not allow to insert for specific apikey", async () => {
      await updateIndex(
        `export const insert = (req) => req.headers.authorization != 'MY_SECRET_TOKEN';`
      );
      const response = await req.post(
        `/bucket/${bucket._id}/data`,
        {username: "user3", password: "password3", age: 36},
        headers
      );
      expect([response.statusCode, response.statusText]).toEqual([403, "Forbidden"]);
    });

    it("should allow to insert", async () => {
      await updateIndex(`export const insert = () => true;`);
      const {body: user3} = await req.post(
        `/bucket/${bucket._id}/data`,
        {username: "user3", password: "password3", age: 36},
        headers
      );
      expect(user3).toEqual({_id: "__skip__", username: "user3", password: "password3", age: 36});
      await req.delete(`/bucket/${bucket._id}/data/${user3._id}`, {}, headers);
    });
  });

  describe("STREAM", () => {
    it("should apply filter", async done => {
      await updateIndex(`export const stream = () => ({username: "test"});`);
      const ws = wsc.get(`/bucket/${bucket._id}/data`);
      ws.onclose = done;
      const message = jasmine.createSpy();
      ws.onmessage = e => {
        const data = JSON.parse(e.data as string);
        console.log(data);
        if (data.kind == 1) {
          expect(message).not.toHaveBeenCalled();
          ws.close();
        } else {
          message(data);
        }
      };
    });

    it("should not fail when an empty object returned", async done => {
      await updateIndex(`export function stream(action) {
        return {};
      };`);
      const ws = wsc.get(`/bucket/${bucket._id}/data`);
      const message = jasmine.createSpy();
      ws.onmessage = e => {
        const data = JSON.parse(e.data as string);
        message(data);
        if (data.kind == 1) {
          ws.close();
        }
      };
      ws.onclose = () => {
        expect(message.calls.allArgs().map(([a]) => a)).toEqual([
          {kind: 0, document: user1},
          {kind: 0, document: user2},
          {kind: 1}
        ]);
        done();
      };
    });

    it("should filter by incoming headers", async done => {
      await updateIndex(`export function stream(action) {
        return {username: action.headers.user};
      };`);
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          user: user1.username
        }
      });
      const message = jasmine.createSpy();
      ws.onmessage = e => {
        const data = JSON.parse(e.data as string);
        message(data);
        if (data.kind == 1) {
          ws.close();
        }
      };
      ws.onclose = () => {
        expect(message.calls.allArgs().map(([a]) => a)).toEqual([
          {kind: 0, document: user1},
          {kind: 1}
        ]);
        done();
      };
    });
  });
});
