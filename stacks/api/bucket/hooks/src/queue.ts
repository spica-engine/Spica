import {hooks} from "@spica-server/bucket/hooks/proto";
import {Queue} from "@spica-server/function/queue";
import * as grpc from "@grpc/grpc-js";

export class ChangeQueue implements Queue<typeof hooks.ChangeQueue> {
  TYPE = hooks.ChangeQueue;

  callbacks = new Map<string, Function>();
  queue = new Map<string, hooks.Change>();

  get size() {
    return this.queue.size;
  }

  pop(
    call: grpc.ServerUnaryCall<hooks.Pop, hooks.Change>,
    callback: grpc.sendUnaryData<hooks.Change>
  ) {
    const action = this.queue.get(call.request.id);
    if (!this.queue.has(call.request.id)) {
      return callback(new Error(`ChangeQueue has no item with id ${call.request.id}`), null);
    }
    this.queue.delete(call.request.id);
    callback(null, action);
  }

  enqueue(id: string, action: hooks.Change, callback?: Function) {
    if (callback) {
      this.callbacks.set(id, callback);
    }
    this.queue.set(id, action);
  }

  create() {
    return {
      pop: this.pop.bind(this)
    };
  }
}
