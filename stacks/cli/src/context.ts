import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export namespace context {
  const ctxPath = path.join(os.homedir(), ".spicactx");

  function load(): {[name: string]: Context} {
    if (!fs.existsSync(ctxPath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(ctxPath).toString());
  }

  function write(ctxs: {[name: string]: Context}): void {
    fs.writeFileSync(ctxPath, JSON.stringify(ctxs));
  }

  export interface Context {
    url: string;
    authorization: string;
  }

  export function set(name: string, data: {url: string; authorization: string}) {
    const cxts = load();
    cxts[name] = data;
    write(cxts);
  }

  export function has(name: string) {
    const cxts = load();
    return !!cxts[name];
  }

  export function get(name: string): Context | undefined {
    const cxts = load();
    return cxts[name];
  }

  export function list(): Array<Context & {name: string}> {
    const cxts = load();
    return Object.entries(cxts).map(([name, ctx]) => ({...ctx, name}));
  }
}
