import {SchedulingOptions} from "@spica-server/function/scheduler";

export const FUNCTION_OPTIONS = Symbol.for("FUNCTION_OPTIONS");

export interface Options {
  timeout: number;
  root: string;
  runtime: SchedulingOptions["runtime"];
}

export interface FunctionOptions extends SchedulingOptions {
  path: string;
  logExpireAfterSeconds: number;
}
