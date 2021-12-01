import {ForbiddenException, INestApplication, UnauthorizedException} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {BucketModule} from "@spica-server/bucket/src";
import {CoreTestingModule, Request, Websocket, Client} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {ChunkKind} from "@spica-server/database/realtime";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {GuardService} from "@spica-server/passport";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, DATE_TIME, OBJECT_ID} from "@spica-server/core/schema/formats";
import {CREATED_AT, UPDATED_AT} from "@spica-server/core/schema/defaults";
import {RealtimeGateway} from "../src/realtime.gateway";

function url(path: string, query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(key, (typeof query[key] == "string"
      ? String(query[key])
      : JSON.stringify(query[key])) as string);
  }
  return `${url.pathname}${url.search}`;
}

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;

  let bucket: any;
  let rows: any[];

  async function insertRow(doc) {
    const {body} = await req.post(`/bucket/${bucket._id}/data`, doc);
    return body;
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PreferenceTestingModule,
        BucketModule.forRoot({
          history: false,
          hooks: false,
          realtime: true,
          cache: false,
          graphql: false
        }),
        PassportTestingModule.initialize()
      ]
    }).compile();
    wsc = module.get(Websocket);
    req = module.get(Request);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    const {body: bkt} = await req.post("/bucket", {
      title: "Realtime",
      description: "Realtime",
      properties: {
        title: {
          type: "string"
        }
      }
    });
    bucket = bkt;

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__objectid__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => await app.close());

  describe("authorization", () => {
    let authGuardCheck: jasmine.Spy<typeof GuardService.prototype.checkAuthorization>;
    let actionGuardCheck: jasmine.Spy<typeof GuardService.prototype.checkAction>;

    beforeEach(() => {
      const guardService = app.get(GuardService);
      authGuardCheck = spyOn(guardService, "checkAuthorization");
      actionGuardCheck = spyOn(guardService, "checkAction");
    });

    it("should authorize and do the initial sync", async done => {
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });

      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":1}`);
        done();
      };
      await ws.connect;
    });

    it("should show error messages", done => {
      authGuardCheck.and.callFake(() => {
        throw new UnauthorizedException();
      });
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = done;
      ws.onmessage = e => {
        expect(e.data).toEqual(`{"kind":-1,"status":401,"message":"Unauthorized"}`);
      };
    });

    it("should the action error message", done => {
      actionGuardCheck.and.callFake(() => {
        throw new ForbiddenException("You do not have sufficient permissions to do this action.");
      });
      const ws = wsc.get(`/bucket/${bucket._id}/data`, {
        headers: {
          Authorization: "APIKEY test"
        }
      });
      ws.onclose = done;
      ws.onmessage = e => {
        expect(e.data).toEqual(
          `{"kind":-1,"status":403,"message":"You do not have sufficient permissions to do this action."}`
        );
      };
    });
  });

  describe("documents", () => {
    const messageSpy = jasmine.createSpy();

    beforeEach(async () => {
      rows = [
        await insertRow({
          title: "first"
        }),
        await insertRow({
          title: "second"
        })
      ];

      messageSpy.calls.reset();
    });

    describe("initial sync", () => {
      const lastMessage = JSON.stringify({kind: ChunkKind.EndOfInitial});

      it("should do the initial sync", async done => {
        const ws = wsc.get(`/bucket/${bucket._id}/data`);

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with filter", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {filter: `title == "second"`}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with _id filter", async done => {
        const ws = wsc.get(
          url(`/bucket/${bucket._id}/data`, {filter: `document._id == "${rows[0]["_id"]}"`})
        );

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with limit", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {limit: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with skip", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with skip and limit", async done => {
        const newRows = [
          await insertRow({
            title: "third"
          }),
          await insertRow({
            title: "fourth"
          })
        ];

        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {skip: 1, limit: 2}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.Initial, document: newRows[0]},

              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });

      it("should do the initial sync with sort", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`, {sort: {_id: -1}}));

        ws.onmessage = async e => {
          messageSpy(JSON.parse(e.data as string));

          if (e.data == lastMessage) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.EndOfInitial}
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;
      });
    });

    //@TODO: enable them when you find a way to solve the timeout problem
    xdescribe("sending message", () => {
      it("should perform insert action and send changes to the clients", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        ws.onmessage = e => {
          messageSpy(JSON.parse(e.data as string));
        };

        await ws.connect;

        const controller = app.get(RealtimeGateway);
        const client = undefined;
        // const client = controller.clients.keys().next().value;

        const document = {title: "title"};

        await controller.insert(client, document);

        await stream.change.next();

        await ws.close();

        expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
          {kind: ChunkKind.Initial, document: rows[0]},
          {kind: ChunkKind.Initial, document: rows[1]},
          {kind: ChunkKind.EndOfInitial},
          {kind: ChunkKind.Response, status: 201, message: "Created"},
          {
            kind: ChunkKind.Insert,
            document: {_id: "__objectid__", title: "title"}
          }
        ]);
      });

      it("should perform replace action and send changes to the clients", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        const lastMessageKind = ChunkKind.Replace;

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);

          messageSpy(message);

          if (message.kind == lastMessageKind) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 200, message: "OK"},
              {
                kind: ChunkKind.Replace,
                document: {_id: rows[0]._id.toString(), title: "updated_title"}
              }
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;

        const controller = app.get(RealtimeGateway);
        const client = undefined;
        //const client = controller.clients.keys().next().value;

        const document = {_id: rows[0]._id.toString(), title: "updated_title"};

        await controller.replace(client, document);
      });

      it("should perform patch action and send changes to the clients", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        const lastMessageKind = ChunkKind.Update;

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == lastMessageKind) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 204, message: "No Content"},
              {
                kind: ChunkKind.Update,
                document: {_id: rows[0]._id.toString()}
              }
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;

        const controller = app.get(RealtimeGateway);

        const client = undefined;
        //const client = controller.clients.keys().next().value;

        const document = {_id: rows[0]._id.toString(), title: null};

        await controller.patch(client, document);
      });

      it("should perform delete action and send changes to the clients", async done => {
        const ws = wsc.get(url(`/bucket/${bucket._id}/data`));

        const lastMessageKind = ChunkKind.Delete;

        ws.onmessage = async e => {
          const message = JSON.parse(e.data as string);
          messageSpy(message);

          if (message.kind == lastMessageKind) {
            expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
              {kind: ChunkKind.Initial, document: rows[0]},
              {kind: ChunkKind.Initial, document: rows[1]},
              {kind: ChunkKind.EndOfInitial},
              {kind: ChunkKind.Response, status: 204, message: "No Content"},
              {
                kind: ChunkKind.Delete,
                document: {_id: rows[0]._id.toString()}
              }
            ]);

            await ws.close();
            done();
          }
        };

        await ws.connect;

        const controller = app.get(RealtimeGateway);

        const client = undefined;
        // const client = controller.clients.keys().next().value;
        const document = {_id: rows[0]._id.toString()};

        await controller.delete(client, document);
      });
    });

    xdescribe("errors", () => {
      const lastMessageKind = ChunkKind.Response;

      describe("schema validation", () => {
        let validationBucket: any = {
          title: "Realtime",
          description: "Realtime",
          properties: {
            title: {
              type: "string"
            }
          },
          required: ["title"]
        };
        beforeEach(async () => {
          await req.post("/bucket", validationBucket).then(res => (validationBucket = res.body));
        });

        it("should reject operation and send errors to the client", async done => {
          const ws = wsc.get(url(`/bucket/${validationBucket._id}/data`));

          ws.onmessage = async e => {
            const message = JSON.parse(e.data as string);

            messageSpy(message);

            if (message.kind == lastMessageKind) {
              expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
                {kind: ChunkKind.EndOfInitial},
                {
                  kind: ChunkKind.Response,
                  status: 400,
                  message: " should have required property 'title'"
                }
              ]);

              await ws.close();
              done();
            }
          };

          await ws.connect;

          const controller = app.get(RealtimeGateway);

          const client = undefined;
          //const client = controller.clients.keys().next().value;

          const document = {};

          await controller.insert(client, document);
        });
      });

      describe("rule", () => {
        let ruleBucket: any = {
          title: "Realtime",
          description: "Realtime",
          properties: {
            title: {
              type: "string"
            }
          },
          acl: {
            write: "true==false",
            read: "true==true"
          }
        };
        beforeEach(async () => {
          await req.post("/bucket", ruleBucket).then(res => (ruleBucket = res.body));
        });

        it("should reject operation cause of rule", async done => {
          const ws = wsc.get(url(`/bucket/${ruleBucket._id}/data`));

          ws.onmessage = async e => {
            const message = JSON.parse(e.data as string);

            messageSpy(message);

            if (message.kind == lastMessageKind) {
              expect(messageSpy.calls.allArgs().map(c => c[0])).toEqual([
                {kind: ChunkKind.EndOfInitial},
                {
                  kind: ChunkKind.Response,
                  status: 401,
                  message: "ACL rules has rejected this operation."
                }
              ]);

              await ws.close();
              done();
            }
          };

          await ws.connect;

          const controller = app.get(RealtimeGateway);

          const client = undefined;
          //const client = controller.clients.keys().next().value;

          const document = {title: "reject_this"};

          await controller.insert(client, document);
        });
      });
    });
  });
});
