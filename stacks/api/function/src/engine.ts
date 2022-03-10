import {Inject, Injectable, Optional, OnModuleDestroy} from "@nestjs/common";
import {DatabaseService, MongoClient} from "@spica-server/database";
import {Scheduler} from "@spica-server/function/scheduler";
import {Package, PackageManager} from "@spica-server/function/pkgmanager";
import {event} from "@spica-server/function/queue/proto";
import * as fs from "fs";
import {JSONSchema7} from "json-schema";
import * as path from "path";
import * as rimraf from "rimraf";
import {Observable, Subject} from "rxjs";
import * as util from "util";
import {
  FunctionService,
  Function,
  FUNCTION_OPTIONS,
  Options,
  COLL_SLUG,
  CollectionSlug
} from "@spica-server/function/services";
import {ChangeKind, TargetChange} from "./change";
import {SCHEMA, SchemaWithName} from "./schema/schema";
import {createTargetChanges} from "./change";
import {RepoStrategies} from "./services/interface";

import HttpSchema = require("./schema/http.json");
import ScheduleSchema = require("./schema/schedule.json");
import FirehoseSchema = require("./schema/firehose.json");
import SystemSchema = require("./schema/system.json");

@Injectable()
export class FunctionEngine implements OnModuleDestroy {
  readonly schemas = new Map<string, unknown>([
    ["http", HttpSchema],
    ["schedule", ScheduleSchema],
    ["firehose", FirehoseSchema],
    ["system", SystemSchema]
  ]);
  readonly runSchemas = new Map<string, JSONSchema7>();

  private dispose = new Subject();

  constructor(
    private fs: FunctionService,
    private db: DatabaseService,
    private scheduler: Scheduler,
    private repos: RepoStrategies,
    @Inject(FUNCTION_OPTIONS) private options: Options,
    @Optional() @Inject(SCHEMA) schema: SchemaWithName,
    @Optional() @Inject(COLL_SLUG) collSlug: CollectionSlug
  ) {
    if (schema) {
      this.schemas.set(schema.name, schema.schema);
    }

    this.schemas.set("database", () => getDatabaseSchema(this.db, collSlug));

    this.fs.find().then(fns => {
      const targetChanges: TargetChange[] = [];
      for (const fn of fns) {
        targetChanges.push(...createTargetChanges(fn, ChangeKind.Added));
      }
      this.categorizeChanges(targetChanges);
    });
  }

  onModuleDestroy() {
    this.dispose.next();
  }

  categorizeChanges(changes: TargetChange[]) {
    for (const change of changes) {
      switch (change.kind) {
        case ChangeKind.Added:
          this.subscribe(change);
          break;
        case ChangeKind.Updated:
          this.unsubscribe(change);
          this.subscribe(change);
          break;
        case ChangeKind.Removed:
          this.unsubscribe(change);
          break;
      }
    }
  }

  private getDefaultPackageManager(): PackageManager {
    return this.scheduler.pkgmanagers.get("node");
  }

  getPackages(fn: Function): Promise<Package[]> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().ls(functionRoot);
  }

  addPackage(fn: Function, qualifiedNames: string | string[]): Observable<number> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().install(functionRoot, qualifiedNames);
  }

  removePackage(fn: Function, name: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return this.getDefaultPackageManager().uninstall(functionRoot, name);
  }

  private async extractCommitFiles() {
    const fns = await this.fs.find({});

    const files: {name: string; content: string}[] = [];

    for (const fn of fns) {
      const extension = fn.language == "typescript" ? ".ts" : ".js";

      const indexPath = path.join(this.options.root, fn._id.toString(), `index${extension}`);
      const indexName = `${fn._id}/index${extension}`;
      const indexContent = await fs.promises.readFile(indexPath, {encoding: "utf8"});

      files.push({name: indexName, content: indexContent});

      const packageJsonPath = path.join(this.options.root, fn._id.toString(), "package.json");
      const packageJsonName = `${fn._id}/package.json`;
      const packageJsonContent = await fs.promises.readFile(packageJsonPath, {encoding: "utf8"});

      files.push({name: packageJsonName, content: packageJsonContent});
    }

    return files;
  }

  async createRepo(strategy: string, repo: string, token: string) {
    await this.repos.find(strategy).createRepo(repo, token);

    return this.pushCommit(strategy, repo, "main", "Initial commit from spica");
  }

  async pushCommit(strategy: string, repo: string, branch: string, message: string) {
    const files = await this.extractCommitFiles();

    return this.repos.find(strategy).pushCommit(files, repo, branch, message);
  }

  async pullCommit(strategy: string, repo: string, branch: string, token: string) {
    const changes = await this.repos.find(strategy).pullCommit(repo, branch, token);
    let updates = 0;
    for (const change of changes) {
      const functionRoot = path.join(this.options.root, change.function);

      const results = await Promise.all(
        change.files.map(file =>
          fs.promises
            .writeFile(path.join(functionRoot, file.name), file.content)
            .then(() => true)
            .catch(e => {
              // @TODO: update this line after we decide to pull and push functions with metadata
              if (e.code == "ENOENT") {
                return false;
              }

              throw Error(e);
            })
        )
      );

      if (results.every(r => r == true)) {
        updates++;
      }
    }
    return updates;
  }

  async createFunction(fn: Function) {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    await fs.promises.mkdir(functionRoot, {recursive: true});
    // See: https://docs.npmjs.com/files/package.json#dependencies
    const packageJson = {
      name: fn.name.replace(" ", "-").toLowerCase(),
      description: fn.description || "No description.",
      version: "0.0.1",
      private: true,
      keywords: ["spica", "function", "node.js"],
      license: "UNLICENSED"
    };

    return fs.promises.writeFile(
      path.join(functionRoot, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );
  }

  deleteFunction(fn: Function) {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    return util.promisify(rimraf)(functionRoot);
  }

  compile(fn: Function) {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    const language = this.scheduler.languages.get(fn.language);
    return language.compile({
      cwd: functionRoot,
      entrypoint: `index.${language.description.extension}`
    });
  }

  update(fn: Function, index: string): Promise<void> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    const language = this.scheduler.languages.get(fn.language);
    return fs.promises.writeFile(
      path.join(functionRoot, `index.${language.description.extension}`),
      index
    );
  }

  read(fn: Function): Promise<string> {
    const functionRoot = path.join(this.options.root, fn._id.toString());
    const language = this.scheduler.languages.get(fn.language);
    return fs.promises
      .readFile(path.join(functionRoot, `index.${language.description.extension}`))
      .then(b => b.toString())
      .catch(e => {
        if (e.code == "ENOENT") {
          return Promise.reject("Not Found");
        }
        throw Error(e);
      });
  }

  getSchema(name: string): Promise<JSONSchema7 | null> {
    const schema = this.schemas.get(name);
    if (schema) {
      if (typeof schema == "function") {
        return schema();
      } else {
        return Promise.resolve(schema);
      }
    }
    return Promise.resolve(null);
  }

  getEnqueuer(name: string) {
    const enq = Array.from(this.scheduler.enqueuers);
    return enq.find(e => e.description.name == name);
  }

  private subscribe(change: TargetChange) {
    const enqueuer = this.getEnqueuer(change.type);
    if (enqueuer) {
      const target = new event.Target({
        id: change.target.id,
        cwd: path.join(this.options.root, change.target.id),
        handler: change.target.handler,
        context: new event.SchedulingContext({
          env: Object.keys(change.target.context.env).reduce((envs, key) => {
            envs.push(
              new event.SchedulingContext.Env({
                key,
                value: change.target.context.env[key]
              })
            );
            return envs;
          }, []),
          timeout: change.target.context.timeout
        })
      });
      enqueuer.subscribe(target, change.options);
    } else {
      console.warn(`Couldn't find enqueuer ${change.type}.`);
    }
  }

  private unsubscribe(change: TargetChange) {
    for (const enqueuer of this.scheduler.enqueuers) {
      const target = new event.Target({
        id: change.target.id,
        cwd: path.join(this.options.root, change.target.id),
        handler: change.target.handler
      });
      enqueuer.unsubscribe(target);
    }
  }
}

export function getDatabaseSchema(
  db: DatabaseService,
  collSlug: CollectionSlug = id => Promise.resolve(id)
): Promise<JSONSchema7> {
  return db.collections().then(async collections => {
    const collSlugMap: Map<string, string> = new Map();

    for (const collection of collections) {
      collSlugMap.set(collection.collectionName, await collSlug(collection.collectionName));
    }

    const schema: JSONSchema7 = {
      $id: "http://spica.internal/function/enqueuer/database",
      type: "object",
      required: ["collection", "type"],
      properties: {
        collection: {
          title: "Collection Name",
          type: "string",
          //@ts-ignore
          viewEnum: Array.from(collSlugMap.values()),
          enum: Array.from(collSlugMap.keys()),
          description: "Collection name that the event will be tracked on"
        },
        type: {
          title: "Operation type",
          description: "Operation type that must be performed in the specified collection",
          type: "string",
          enum: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
        }
      },
      additionalProperties: false
    };
    return schema;
  });
}
