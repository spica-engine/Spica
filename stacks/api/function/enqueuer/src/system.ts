import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import {Subject} from "rxjs";
import {debounceTime, take} from "rxjs/operators";
import {Description, Enqueuer} from "./enqueuer";

interface EventOptions {
  name: "READY";
}

export class SystemEnqueuer implements Enqueuer<EventOptions> {
  private readyTargets = new Set<event.Target>();
  private subscriptionSubject = new Subject();

  description: Description = {
    icon: "build",
    name: "system",
    title: "System",
    description: "Designed to interact with the system events."
  };

  constructor(private queue: EventQueue) {
    this.subscriptionSubject
      .pipe(
        debounceTime(1000),
        take(1)
      )
      .subscribe(() => this.invokeReadyEventTargets());
  }

  private invokeReadyEventTargets() {
    for (const target of this.readyTargets) {
      this.queue.enqueue(
        new event.Event({
          type: event.Type.SYSTEM,
          target
        })
      );
    }
  }

  subscribe(target: event.Target, options: EventOptions): void {
    if (options.name == "READY") {
      this.readyTargets.add(target);
      this.subscriptionSubject.next(target);
    }
  }

  unsubscribe(target: event.Target): void {
    for (const eventTarget of this.readyTargets) {
      if (
        (!target.handler && eventTarget.cwd == target.cwd) ||
        (target.handler && eventTarget.cwd == target.cwd && eventTarget.handler == target.handler)
      ) {
        this.readyTargets.delete(eventTarget);
      }
    }
  }
}
