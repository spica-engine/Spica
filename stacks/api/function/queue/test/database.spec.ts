import {DatabaseQueue, EventQueue} from "@spica-server/function/queue";
import {Database} from "@spica-server/function/queue/proto";
import {credentials} from "@grpc/grpc-js";

describe("DatabaseQueue", () => {
  let queue: EventQueue;
  let databaseQueue: DatabaseQueue;
  let databaseQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(() => {}, () => {}, () => {}, () => {});
    databaseQueue = new DatabaseQueue();
    queue.addQueue(databaseQueue);
    queue.listen();
    databaseQueueClient = new Database.QueueClient(
      process.env.FUNCTION_GRPC_ADDRESS,
      credentials.createInsecure()
    );
  });

  afterEach(() => {
    queue.kill();
    databaseQueueClient.close();
  });

  describe("pop", () => {
    it("should return error", done => {
      const pop = new Database.Change.Pop();
      pop.id = "1";
      databaseQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();
        done();
      });
    });

    it("should not return error", done => {
      const pop = new Database.Change.Pop();
      pop.id = "2";

      databaseQueue.enqueue(pop.id, new Database.Change());

      databaseQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Database.Change).toBe(true);
        done();
      });
    });
  });
});
