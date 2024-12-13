import {blue, bold, red, yellow} from "colorette";
import * as columnify from "columnify";
import * as ora from "ora";
import * as util from "util";

export function spin(options?: ora.Options): ora.Ora;
export function spin<T = any>(options?: ora.Options & {op: Promise<T>}): Promise<T>;
export function spin<T = any>(
  options?: ora.Options & {op: (spinner: ora.Ora) => Promise<T>}
): Promise<T>;
export function spin(
  options?: ora.Options & {op?: Promise<unknown> | ((spinner: ora.Ora) => Promise<unknown>)}
) {
  const spinner = ora({...options, color: options.color || "yellow"});
  if (typeof options.op == "function") {
    options.op = options.op(spinner);
  }
  if (options.op instanceof Promise) {
    spinner.start();
    return options.op.then(
      result => {
        spinner.succeed();
        return result;
      },
      error => {
        spinner.fail();
        if (typeof error == "object" && "message" in error) {
          console.error(error.message);
          console.debug(error);
          process.exit();
        }
        return Promise.reject(error);
      }
    );
  }
  return spinner.start();
}

export class Logger extends console.Console {
  error(message?: any, ...optionalParams: any[]) {
    super.error(bold(red(util.format(message, ...optionalParams))));
  }

  warn(message?: any, ...optionalParams: any[]) {
    super.warn(bold(yellow(util.format(message, ...optionalParams))));
  }

  info(message?: any, ...optionalParams: any[]) {
    super.info(bold(blue(util.format(message, ...optionalParams))));
  }

  table(tabularData: any, columns?: string[]) {
    if (!columns) {
      super.log(columnify(tabularData, {columnSplitter: "       "}));
    } else {
      super.log(columnify(tabularData, {columns, columnSplitter: "       "}));
    }
  }
}

global.console = new Logger(process.stdout, process.stderr);
