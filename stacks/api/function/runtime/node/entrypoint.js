import * as Bucket from "@spica-server/bucket/hooks/proto/node";
import {hooks as BucketHooks} from "@spica-server/bucket/hooks/proto";
import {
  Change,
  DatabaseQueue,
  EventQueue,
  FirehosePool,
  FirehoseQueue,
  FirehoseSocket,
  HttpQueue,
  Message,
  Request,
  Response
} from "@spica-server/function/queue/node";
import {Database, event, Firehose, Http} from "@spica-server/function/queue/proto";
import {createRequire} from "module";
import * as path from "path";

if (!process.env.FUNCTION_GRPC_ADDRESS) {
  exitAbnormally("Environment variable FUNCTION_GRPC_ADDRESS was not set.");
}

if (!process.env.ENTRYPOINT) {
  exitAbnormally("Environment variable ENTRYPOINT was not set.");
}

if (!process.env.WORKER_ID) {
  exitAbnormally("Environment variable WORKER_ID was not set.");
}

(async () => {
  const queue = new EventQueue();
  const pop = new event.Pop({
    id: process.env.WORKER_ID
  });
  await initialize();
  let ev;
  while (
    (ev = await queue.pop(pop).catch(e => {
      if (typeof e == "object" && e.code == 5) {
        return Promise.resolve();
      }
      return Promise.reject(e);
    }))
  ) {
    await _process(ev, queue);
    if (!ev.target.context.batch) {
      break;
    }
  }
})();

async function initialize() {
  if (process.env.__EXPERIMENTAL_DEVKIT_DATABASE_CACHE) {
    const _require = globalThis.require;
    globalThis.require = createRequire(path.join(process.cwd(), "external/npm/node_modules"));
    await import("./experimental_database");
    globalThis.require = _require;
  }
}

async function _process(ev, queue) {
  process.chdir(ev.target.cwd);

  process.env.TIMEOUT = String(ev.target.context.timeout);

  for (const env of ev.target.context.env) {
    process.env[env.key] = env.value;
  }

  const callArguments = [];

  let callback = async () => {};

  switch (ev.type) {
    case event.Type.HTTP:
      const httpQueue = new HttpQueue();
      const httpPop = new Http.Request.Pop({
        id: ev.id
      });

      const handleRejection = error => {
        if (error && "code" in error && error.code == 1) {
          error.details = `The http request "${ev.id}" handled through "${ev.target.handler}" has been cancelled by the user.`;
          console.error(error.details);
          return Promise.reject(error.details);
        }
        return Promise.reject(error);
      };

      const request = await httpQueue.pop(httpPop).catch(handleRejection);
      const response = new Response(
        e => {
          e.id = ev.id;
          return httpQueue.writeHead(e).catch(handleRejection);
        },
        e => {
          e.id = ev.id;
          return httpQueue.write(e).catch(handleRejection);
        },
        e => {
          e.id = ev.id;
          return httpQueue.end(e).catch(handleRejection);
        }
      );

      callArguments[0] = new Request(request);
      callArguments[1] = response;

      callback = async result => {
        if (!response.headersSent && result != undefined) {
          if (result instanceof Promise) {
            result = await result;
          }
          if (result != undefined && !response.headersSent) {
            return response.send(result);
          }
        }
      };
      break;
    case event.Type.DATABASE:
      const database = new DatabaseQueue();
      const databasePop = new Database.Change.Pop({
        id: ev.id
      });
      const change = await database.pop(databasePop);
      callArguments[0] = new Change(change);
      break;
    case event.Type.FIREHOSE:
      const firehose = new FirehoseQueue();
      const {client: clientDescription, pool: poolDescription, message} = await firehose.pop(
        new Firehose.Message.Pop({
          id: ev.id
        })
      );
      callArguments[1] = new Message(message);
      callArguments[0] = {
        socket: new FirehoseSocket(
          clientDescription,
          () => {
            firehose.close(
              new Firehose.Close({
                client: clientDescription
              })
            );
          },
          message => {
            firehose.send(
              new Firehose.Message.Outgoing({
                client: clientDescription,
                message
              })
            );
          }
        ),
        pool: new FirehosePool(poolDescription, message => firehose.sendAll(message))
      };
      break;
    case event.Type.SCHEDULE:
    case event.Type.SYSTEM:
    case -1:
      // NO OP
      break;
    case event.Type.BUCKET:
      const changeQueue = new Bucket.ChangeQueue();
      const bucketChange = await changeQueue.pop(
        new BucketHooks.Pop({
          id: ev.id
        })
      );
      callArguments[0] = new Bucket.Change(bucketChange);
      break;
    default:
      exitAbnormally(`Invalid event type received. (${ev.type})`);
      break;
  }

  globalThis.require = createRequire(path.join(process.cwd(), "node_modules"));

  let module = await import(
    path.join(process.cwd(), ".build", process.env.ENTRYPOINT) + "?event=" + ev.id
  );

  if ("default" in module && module.default.__esModule) {
    module = module.default; // Do not ask me why
  }

  try {
    // Call the function
    if (!(ev.target.handler in module)) {
      await queue.complete(new event.Complete({id: ev.id, succedded: false}));
      exitAbnormally(`This function does not export any symbol named '${ev.target.handler}'.`);
    } else if (typeof module[ev.target.handler] != "function") {
      await queue.complete(new event.Complete({id: ev.id, succedded: false}));
      exitAbnormally(
        `This function does export a symbol named '${ev.target.handler}' but it is not a function.`
      );
    }
    await callback(module[ev.target.handler](...callArguments));
    queue.complete(new event.Complete({id: ev.id, succedded: true}));
  } catch (e) {
    queue.complete(new event.Complete({id: ev.id, succedded: false}));
    throw e;
  }
}

function exitAbnormally(reason) {
  if (reason) {
    console.error(reason);
  }
  process.exit(126);
}
