import {EventQueue} from "@spica-server/function/queue";
import {event} from "@spica-server/function/queue/proto";
import * as cron from "cron";
import {Description, Enqueuer} from "./enqueuer";

interface ScheduleOptions {
  frequency: string;
  timezone: string;
}

export class ScheduleEnqueuer implements Enqueuer<ScheduleOptions> {
  private jobs = new Set<cron.CronJob>();

  description: Description = {
    icon: "schedule",
    name: "schedule",
    title: "Scheduler",
    description: "Designed for scheduled tasks and jobs."
  };

  constructor(private queue: EventQueue) {}

  subscribe(target: event.Target, options: ScheduleOptions): void {
    const job = new cron.CronJob({
      cronTime: options.frequency,
      onTick: () => {
        const ev = new event.Event({
          target,
          type: event.Type.SCHEDULE
        });
        this.queue.enqueue(ev);
      },
      start: true,
      timeZone: options.timezone
    });
    Object.defineProperty(job, "target", {writable: false, value: target});
    this.jobs.add(job);
  }

  unsubscribe(target: event.Target): void {
    for (const job of this.jobs) {
      if (
        (!target.handler && job["target"].cwd == target.cwd) ||
        (target.handler &&
          job["target"].cwd == target.cwd &&
          job["target"].handler == target.handler)
      ) {
        job.stop();
        this.jobs.delete(job);
      }
    }
  }
}
