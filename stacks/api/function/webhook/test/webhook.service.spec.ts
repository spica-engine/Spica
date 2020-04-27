import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, stream} from "@spica-server/database/testing";
import {ChangeKind, WebhookService} from "@spica-server/function/webhook";
import {bufferCount, bufferTime} from "rxjs/operators";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Webhook Service", () => {
  let service: WebhookService;
  let module: TestingModule;
  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet()],
      providers: [WebhookService]
    }).compile();
    service = module.get(WebhookService);
  });

  afterEach(async () => await module.close());

  it("should report send target which is not active", async done => {
    const hook = await service.insertOne({
      url: "http://spica.internal/test",
      trigger: {
        name: "database",
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    });

    service
      .targets()
      .pipe(bufferTime(1000))
      .subscribe(targets => {
        expect(targets).toEqual([]);
        done();
      });
  });

  it("should report target which is active", async done => {
    const hook = await service.insertOne({
      url: "http://spica.internal/test",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    });

    service
      .targets()
      .pipe(bufferCount(1))
      .subscribe(targets => {
        expect(targets).toEqual([
          {
            kind: ChangeKind.Added,
            target: hook._id.toHexString(),
            webhook: {
              url: hook.url,
              trigger: hook.trigger
            }
          }
        ]);
        done();
      });
  });

  it("should report newly added hook", async done => {
    service
      .targets()
      .pipe(bufferCount(1))
      .subscribe(targets => {
        expect(targets).toEqual([
          {
            kind: ChangeKind.Added,
            target: hook._id.toHexString(),
            webhook: {
              url: hook.url,
              trigger: hook.trigger
            }
          }
        ]);
        done();
      });
    await stream.wait();
    const hook = await service.insertOne({
      url: "http://spica.internal/test",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    });
  });

  it("should report removed hook", async done => {
    const hook = await service.insertOne({
      url: "http://spica.internal/test",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    });
    service
      .targets()
      .pipe(bufferCount(2))
      .subscribe(targets => {
        expect(targets).toEqual([
          {
            kind: ChangeKind.Added,
            target: hook._id.toHexString(),
            webhook: {
              url: hook.url,
              trigger: hook.trigger
            }
          },
          {
            kind: ChangeKind.Removed,
            target: hook._id.toHexString()
          }
        ]);
        done();
      });
    await stream.wait();
    await service.deleteOne({_id: hook._id});
  });

  it("should report hook as removed when deactivated", async done => {
    const hook = await service.insertOne({
      url: "http://spica.internal/test",
      trigger: {
        name: "database",
        active: true,
        options: {
          collection: "test",
          type: "INSERT"
        }
      }
    });
    service
      .targets()
      .pipe(bufferCount(2))
      .subscribe(targets => {
        expect(targets).toEqual([
          {
            kind: ChangeKind.Added,
            target: hook._id.toHexString(),
            webhook: {
              url: hook.url,
              trigger: hook.trigger
            }
          },
          {
            kind: ChangeKind.Removed,
            target: hook._id.toHexString()
          }
        ]);
        done();
      });
    await stream.wait();
    await service.updateOne({_id: hook._id}, {$set: {"trigger.active": false}});
  });
});
