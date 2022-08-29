import {Injectable, Scope} from "@nestjs/common";
import {CommandMessenger} from "./messenger";
import {
  CommandMessage,
  CommandMessageFilter,
  CommandSource,
  CommandTarget,
  Command
} from "./interface";

abstract class Commander {
  protected filters: CommandMessageFilter[] = [];

  public readonly replicaId: string;
  constructor(private cmdMessenger: CommandMessenger) {
    this.replicaId = this.cmdMessenger.replicaId;
  }

  register(ctx: Object, ...args): void {
    const onMessageReceived = (msg: CommandMessage) => {
      if (!this.filters.every(filter => filter(msg))) {
        return;
      }

      for (const cmd of msg.target.commands) {
        this.executeCommand(ctx, cmd);
      }
    };

    this.cmdMessenger.subscribe({
      next: onMessageReceived
    });
  }

  protected emit(source: CommandSource, target: CommandTarget) {
    this.cmdMessenger.publish({
      source,
      target
    });
  }

  private executeCommand(ctx: Object, cmd: Command) {
    if (!ctx[cmd.handler]) {
      return console.error(
        `Replica ${this.cmdMessenger.replicaId} has no method named ${cmd.handler} on ${cmd.class}`
      );
    }

    try {
      ctx[cmd.handler](...cmd.args);
    } catch (error) {
      console.error(
        `Replica ${this.cmdMessenger.replicaId} has failed to execute command ${cmd.class}.${cmd.handler}(${cmd.args})`
      );
      return console.error(error);
    }
  }
}

@Injectable({scope: Scope.TRANSIENT})
export class ClassCommander extends Commander {
  constructor(cmdMessenger: CommandMessenger) {
    super(cmdMessenger);
  }

  register(ctx: Object, fns: Function[]) {
    // add new function named copy_fn and call the original fn inside of it
    // modify original fn as it will emit copy_fn to others and call the copy_fn
    // since copy_fn will call the original fn, there won't be any change on original implementation
    // but it's important to emiting copy_fn not original fn, otherwise all replicas will emit these calls infinitely.
    for (const fn of fns) {
      const handler = fn.name;
      ctx[`copy_${handler}`] = fn;

      ctx[handler] = (...args) => {
        this._emit({
          command: {
            class: ctx.constructor.name,
            handler: `copy_${handler}`,
            args
          }
        });
        return ctx[`copy_${handler}`](...args);
      };
    }

    const filter = (msg: CommandMessage) => this.isSameClass(msg, ctx);

    this.filters.push(filter);

    super.register(ctx);
  }

  private _emit(source: CommandSource) {
    const target: CommandTarget = {
      commands: [source.command]
    };
    super.emit(source, target);
  }

  private isSameClass(msg: CommandMessage, ctx: Object) {
    return msg.source.command.class == ctx.constructor.name;
  }
}
