import {EventQueue, FirehoseQueue} from "@spica-server/function/queue";
import {Firehose} from "@spica-server/function/queue/proto";
import {credentials} from "grpc";

describe("FirehoseQueue", () => {
  let queue: EventQueue;
  let firehoseQueue: FirehoseQueue;
  let firehoseQueueClient: any;

  beforeEach(() => {
    queue = new EventQueue(() => {});
    firehoseQueue = new FirehoseQueue();
    queue.addQueue(firehoseQueue);
    queue.listen();
    firehoseQueueClient = new Firehose.QueueClient("0.0.0.0:5678", credentials.createInsecure());
  });

  afterEach(() => {
    queue.kill();
  });

  describe("pop", () => {
    it("should return error", done => {
      const pop = new Firehose.Message.Pop({
        id: "1"
      });
      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).not.toBeUndefined();
        expect(e.message).toBe("2 UNKNOWN: Queue has no item with id 1");
        expect(req).toBeUndefined();
        done();
      });
    });

    it("should not return error", done => {
      const pop = new Firehose.Message.Pop({
        id: "2"
      });
      firehoseQueue.enqueue(pop.id, new Firehose.Message.Incoming(), undefined);

      firehoseQueueClient.pop(pop, (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Message.Incoming).toBe(true);
        done();
      });
    });
  });

  it("should send message to socket", done => {
    const socket = jasmine.createSpyObj("Websocket", ["send"]);
    const client = new Firehose.ClientDescription({
      id: "1"
    });

    const incomingMessage = new Firehose.Message.Incoming({
      client,
      message: new Firehose.Message({
        name: "connection"
      })
    });

    firehoseQueue.enqueue("1", incomingMessage, socket);

    const outgoingMessage = new Firehose.Message.Outgoing({
      client,
      message: new Firehose.Message({
        name: "test"
      })
    });

    firehoseQueueClient.send(outgoingMessage, (e, req) => {
      expect(e).toBe(null);
      expect(req instanceof Firehose.Message.Result).toBe(true);
      expect(socket.send).toHaveBeenCalledTimes(1);
      expect(socket.send).toHaveBeenCalledWith(`{"name":"test"}`);
      done();
    });
  });

  it("should send message to all OPEN sockets", done => {
    const firstSocket = jasmine.createSpyObj("Websocket", ["send"]);
    firstSocket.readyState = 1; /* https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState */

    firehoseQueue.enqueue(
      "1",
      new Firehose.Message.Incoming({
        client: new Firehose.ClientDescription({
          id: "1"
        }),
        message: new Firehose.Message({
          name: "connection"
        })
      }),
      firstSocket
    );

    const secondSocket = jasmine.createSpyObj("Websocket", ["send"]);
    secondSocket.readyState = 2; /* https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState */

    firehoseQueue.enqueue(
      "2",
      new Firehose.Message.Incoming({
        client: new Firehose.ClientDescription({
          id: "2"
        }),
        message: new Firehose.Message({
          name: "connection"
        })
      }),
      secondSocket
    );

    firehoseQueueClient.sendAll(
      new Firehose.Message({
        name: "test",
        data: JSON.stringify("data")
      }),
      (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Message.Result).toBe(true);
        expect(firstSocket.send).toHaveBeenCalledTimes(1);
        expect(firstSocket.send).toHaveBeenCalledWith(`{"name":"test","data":"data"}`);
        expect(secondSocket.send).not.toHaveBeenCalled();
        done();
      }
    );
  });

  it("should close socket", done => {
    const socket = jasmine.createSpyObj("Websocket", ["close"]);
    socket.readyState = 1; /* https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState */
    const client = new Firehose.ClientDescription({
      id: "1"
    });

    firehoseQueue.enqueue(
      "1",
      new Firehose.Message.Incoming({
        client,
        message: new Firehose.Message({
          name: "connection"
        })
      }),
      socket
    );

    firehoseQueueClient.close(
      new Firehose.Close({
        client
      }),
      (e, req) => {
        expect(e).toBe(null);
        expect(req instanceof Firehose.Close.Result).toBe(true);
        expect(socket.close).toHaveBeenCalledTimes(1);
        done();
      }
    );
  });
});
