import {Description, Runtime, SpawnOptions, Worker} from "@spica-server/function/runtime";
import * as child_process from "child_process";
import * as path from "path";
import {Writable} from "stream";

//@TODO: fix here once we find a better way to set the base path for dev, prod and test environments 
const getEntrypointPath = () => {
  let basePath = path.join(__dirname, "..");
  const isTestEnv = process.env.NODE_ENV == "test";
  if (isTestEnv) {
    basePath = path.join(basePath, "..", "..", ".." ,"..", "..", "dist", "apps");
  }
  return path.join(basePath, "worker", "entrypoint.js");
};

class NodeWorker extends Worker {
  private _process: child_process.ChildProcess;
  private _quit = false;

  private get quit() {
    return this._process.killed || this._quit;
  }

  constructor(options: SpawnOptions) {
    super();
    this._process = child_process.spawn(
      `node`,
      ["--import=extensionless/register", getEntrypointPath()],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FUNCTION_GRPC_ADDRESS: process.env.FUNCTION_GRPC_ADDRESS,
          ENTRYPOINT: "index.js",
          RUNTIME: "node",
          WORKER_ID: options.id,
          ...options.env
        }
      }
    );
    this._process.once("exit", () => (this._quit = true));
    Object.assign(this, this._process);
  }

  attach(stdout?: Writable, stderr?: Writable): void {
    this._process.stdout.unpipe();
    this._process.stderr.unpipe();

    this._process.stdout.pipe(stdout);
    this._process.stderr.pipe(stderr);
  }

  kill() {
    if (this.quit) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      this._process.once("exit", () => resolve());
      this._process.kill("SIGTERM");
    });
  }
}

export class Node extends Runtime {
  description: Description = {
    name: "node",
    title: "Node.js 12",
    description: "Node.js® is a JavaScript runtime built on Chrome's V8 JavaScript engine."
  };

  spawn(options: SpawnOptions): Worker {
    return new NodeWorker(options);
  }
}
