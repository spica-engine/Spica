import {EventQueue} from "@spica-server/function/queue";
import {Event} from "@spica-server/function/queue/proto";

describe("EventQueue", () => {
  let eventQueue: EventQueue;
  let enqueueSpy: jasmine.Spy;
  let popSpy: jasmine.Spy;

  beforeEach(() => {
    enqueueSpy = jasmine.createSpy("enqueue");
    popSpy = jasmine.createSpy("pop");
    eventQueue = new EventQueue(enqueueSpy, popSpy);
  });

  afterEach(() => {
    eventQueue.kill();
  });

  it("should enqueue event", () => {
    const event = new Event.Event();
    event.type = Event.Type.DATABASE;
    eventQueue.enqueue(event);
    expect(enqueueSpy).toHaveBeenCalled();
    expect(event.id).toBeTruthy();
  });

  it("should pop event", () => {
    const event = new Event.Event({
      type: Event.Type.DATABASE
    });
    eventQueue.enqueue(event);

    const callbackSpy = jasmine.createSpy("unaryCallback");
    const pop = new Event.Pop({
      id: "worker_id"
    });

    eventQueue.pop({request: pop} as any, callbackSpy);

    const lastCall = callbackSpy.calls.mostRecent();
    expect(popSpy).toHaveBeenCalledTimes(1);
    expect(popSpy).toHaveBeenCalledWith(event, pop.id);
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(lastCall.args[0]).toBeUndefined();
    expect(lastCall.args[1] instanceof Event.Event).toBe(true);
  });

  it("should hold the pop request until a new message received", async () => {
    const callbackSpy = jasmine.createSpy("unaryCallback").and.callFake(() => {});
    const pop = new Event.Pop({
      id: "worker_id"
    });

    (() => {
      eventQueue.pop({request: pop} as any, callbackSpy);
    })();
    expect(callbackSpy).not.toHaveBeenCalled();

    const event = new Event.Event({
      type: Event.Type.DATABASE
    });
    eventQueue.enqueue(event);

    await Promise.resolve();

    const lastCall = callbackSpy.calls.mostRecent();
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(lastCall.args[0]).toBeUndefined();
    expect(lastCall.args[1] instanceof Event.Event).toBe(true);
    expect(popSpy).toHaveBeenCalledBefore(callbackSpy);
  });
});
