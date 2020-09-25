import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {WebhookService} from "@spica-server/function/webhook";
import {SchemaResolver} from "@spica-server/function/webhook/src/schema";
import {WebhookController} from "@spica-server/function/webhook/src/webhook.controller";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {WebhookInvoker} from "@spica-server/function/webhook/src/invoker";
import {WebhookLogService} from "@spica-server/function/webhook/src/log.service";
import {WEBHOOK_OPTIONS} from "../src";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Webhook Controller", () => {
  let app: INestApplication;
  let req: Request;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        PassportTestingModule.initialize(),
        SchemaModule.forChild()
      ],
      controllers: [WebhookController],
      providers: [
        WebhookService,
        SchemaResolver,
        WebhookInvoker,
        WebhookLogService,
        {provide: WEBHOOK_OPTIONS, useValue: {expireAfterSeconds: 60}}
      ]
    }).compile();
    req = module.get(Request);
    app = module.createNestApplication();
    req.reject = true;
    await app.listen(req.socket);

    const db = module.get(DatabaseService);
    await db.createCollection("coll1");
    await db.createCollection("coll2");

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
    });
  });

  afterEach(async () => await app.close());

  it("should list webhooks", async () => {
    const {body: hooks} = await req.get("/webhook", {});
    expect(hooks).toEqual({
      meta: {total: 0},
      data: []
    });
  });

  it("should insert a new webhook", async () => {
    const {body: hook} = await req.post("/webhook", {
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    });

    expect(hook).toEqual({
      _id: "__skip__",
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    });
  });

  it("should update existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", {
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    });

    const {body: updatedHook} = await req.put(`/webhook/${hook._id}`, {
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll2",
          type: "INSERT"
        }
      }
    });

    expect(updatedHook).toEqual({
      _id: "__skip__",
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "coll2",
          type: "INSERT"
        }
      }
    });
  });

  it("should delete existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", {
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    });

    const result = await req.delete(`/webhook/${hook._id}`);

    expect(result.body).not.toBeTruthy();
    expect(result.statusCode).toBe(204);
  });

  it("should show existing webhook", async () => {
    const {body: hook} = await req.post("/webhook", {
      url: "https://spica.internal",
      body: "",
      trigger: {
        name: "database",
        options: {
          collection: "coll1",
          type: "INSERT"
        }
      }
    });

    const {body: existingWebhook} = await req.get(`/webhook/${hook._id}`, undefined);
    expect(existingWebhook).toEqual(hook);
  });

  it("should list collections", async () => {
    const {body: collections} = await req.get("/webhook/collections", undefined);
    expect(collections.sort((a, b) => a.localeCompare(b))).toEqual([
      "coll1",
      "coll2",
      "webhook_logs"
    ]);
  });

  describe("validation", () => {
    it("should report if the collection does not exist", async () => {
      const {body: validationErrors} = await req
        .post("/webhook", {
          url: "https://spica.internal",
          body: "",
          trigger: {
            name: "database",
            options: {
              collection: "collection_that_does_not_exist",
              type: "INSERT"
            }
          }
        })
        .catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("validation failed");
      expect(validationErrors.message).toBe(
        ".trigger.options.collection should be equal to one of the allowed values"
      );
    });

    it("should report if body is missing", async () => {
      const {body: validationErrors} = await req
        .post("/webhook", {
          url: "https://spica.internal",
          trigger: {
            name: "database",
            options: {
              collection: "collection_that_does_not_exist",
              type: "INSERT"
            }
          }
        })
        .catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("validation failed");
      expect(validationErrors.message).toBe(" should have required property 'body'");
    });

    it("should report if compilation failed for insert", async () => {
      const {body: validationErrors} = await req
        .post("/webhook", {
          url: "https://spica.internal",
          body: "{{invali_body}",
          trigger: {
            name: "database",
            options: {
              collection: "coll1",
              type: "INSERT"
            }
          }
        })
        .catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("Bad Request");
      expect(validationErrors.message.startsWith("Error: Parse error")).toEqual(true);
    });

    it("should report if compilation failed for update", async () => {
      const {body: webhook} = await req.post("/webhook", {
        url: "https://spica.internal",
        body: "{}",
        trigger: {
          name: "database",
          options: {
            collection: "coll1",
            type: "INSERT"
          }
        }
      });

      const {body: validationErrors} = await req
        .put(`/webhook/${webhook._id}`, {
          url: "https://spica.internal",
          body: "{{invali_body}",
          trigger: {
            name: "database",
            options: {
              collection: "coll1",
              type: "INSERT"
            }
          }
        })
        .catch(e => e);
      expect(validationErrors.statusCode).toBe(400);
      expect(validationErrors.error).toBe("Bad Request");
      expect(validationErrors.message.startsWith("Error: Parse error")).toEqual(true);
    });
  });
});
