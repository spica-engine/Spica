import {ActionParameters, CaporalValidator, Command, CreateCommandParameters} from "@caporal/core";
import {spin} from "../../console";
import {httpService} from "../../http";
import {validateMigrationModules} from "../../validator";
import {bold, green, red, underline} from "colorette";

// we might want to use our differ instead
const isEqual = require("lodash/isEqual");

async function sync({
  options: {sourceUrl, sourceApikey, targetUrl, targetApikey, modules, dryRun, syncFnEnv}
}: ActionParameters) {
  const sourceService = httpService.create({
    baseUrl: sourceUrl.toString(),
    authorization: `APIKEY ${sourceApikey}`
  });

  const targetService = httpService.create({
    baseUrl: targetUrl.toString(),
    authorization: `APIKEY ${targetApikey}`
  });

  modules = modules
    .toString()
    .split(",")
    .map(m => m.trim());

  const synchronizers = [];

  const fnSynchronizer = new FunctionSynchronizer(sourceService, targetService, {syncFnEnv});
  const fnSubModuleSynchronizers = await fnSynchronizer.initialize();
  synchronizers.push(fnSynchronizer);
  synchronizers.push(...fnSubModuleSynchronizers);

  const bucketSynchronizer = new BucketSynchronizer(sourceService, targetService);
  const bucketSubModuleSynchronizers = await bucketSynchronizer.initialize();
  synchronizers.push(bucketSynchronizer);
  synchronizers.push(...bucketSubModuleSynchronizers);

  for (const name of modules) {
    const moduleSynchronizers = synchronizers.filter(s => s.moduleName == name);

    if (!moduleSynchronizers.length) {
      throw Error(`Module ${name} does not exist.`);
    }

    for (const synchronizer of moduleSynchronizers) {
      const {inserts, updates, deletes} = await synchronizer.analyze();
      if (dryRun) {
        printActions({
          inserts,
          updates,
          deletes,
          field: synchronizer.primaryField,
          objectName: synchronizer.getObjectName()
        });
      } else {
        await synchronizer.synchronize();
        console.log(
          `\n${synchronizer.getObjectName()} synchronization has been completed!`.toUpperCase()
        );
      }
    }
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand(
    `Synchronize selected module objects between two spica instances(local or remote).
${red(
  "ATTENTION"
)}: Source and target instance versions must be higher than v0.9.17 and for the best results both instance versions should be the same. 
Also this command will perform adding, overwriting and removing actions of the target instance and it's irreversible. 
We highly recommend you to use --dry-run=true and check the changes that will be applied before start.`
  )
    .option("--source-url", "API address of the instance where objects will be synchronized from", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option("--source-apikey", "Apikey of the instance where objects will be synchronized from", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option("--target-url", "API address of the instance where objects will be synchronized to", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .option(
      "--target-apikey",
      "API address of the instance where objects will be synchronized to",
      {
        required: true,
        validator: CaporalValidator.STRING
      }
    )
    .option("--modules", "Module names of objects that will be synchronized", {
      required: true,
      default: ["bucket", "function"],
      validator: validateMigrationModules
    })
    .option("--dry-run", "Shows the changes that will be applied to the target instance.", {
      default: false
    })
    .option(
      "--sync-fn-env",
      "Set true if you need to sync function environment variables as well.",
      {
        default: false
      }
    )
    .action(sync);
}

export class ObjectActionDecider {
  private existingObjects = [];
  private existingObjectIds = [];

  constructor(
    private sourceObjects: any[],
    private targetObjects: any[],
    private uniqueField = "_id"
  ) {
    this.existingObjects = targetObjects.filter(targetObject =>
      sourceObjects.some(
        sourceObject => sourceObject[this.uniqueField] == targetObject[this.uniqueField]
      )
    );

    this.existingObjectIds = this.existingObjects.map(o => o[this.uniqueField]);
  }

  updates() {
    const updates = [];
    for (const existing of this.existingObjects) {
      const source = this.sourceObjects.find(
        source => source[this.uniqueField] == existing[this.uniqueField]
      );
      if (!isEqual(source, existing)) {
        updates.push(source);
      }
    }

    return updates;
  }

  inserts() {
    return this.sourceObjects.filter(
      source => this.existingObjectIds.indexOf(source[this.uniqueField]) == -1
    );
  }

  deletes() {
    return this.targetObjects.filter(
      target => this.existingObjectIds.indexOf(target[this.uniqueField]) == -1
    );
  }
}

interface ModuleSynchronizer {
  moduleName: string;
  subModuleName?: string;
  primaryField: string;

  inserts: any[];
  updates: any[];
  deletes: any[];

  initialize(): Promise<ModuleSynchronizer[]>;

  analyze(): Promise<{inserts: any[]; updates: any[]; deletes: any[]}>;
  synchronize(): Promise<any>;

  getObjectName(): string;
}

export class FunctionSynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  primaryField = "name";

  inserts = [];
  updates = [];
  deletes = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client,
    private options: {syncFnEnv}
  ) {}

  async initialize() {
    const synchronizers = [];

    let sourceFns = await this.sourceService.get<any[]>("function");

    // put dependency synchronizer for each function
    for (const fn of sourceFns) {
      synchronizers.push(
        new FunctionDependencySynchronizer(this.sourceService, this.targetService, fn)
      );
    }

    synchronizers.push(new FunctionIndexSynchronizer(this.sourceService, this.targetService));

    return synchronizers;
  }

  async analyze() {
    console.log();
    let sourceFns = await spin<any>({
      text: "Fetching functions from source instance",
      op: () => this.sourceService.get("function")
    });

    const targetFns = await spin<any>({
      text: "Fetching functions from target instance",
      op: () => this.targetService.get<any[]>("function")
    });

    if (!this.options.syncFnEnv) {
      sourceFns = sourceFns.map(fn => {
        fn.env = {};
        return fn;
      });
      for (const target of targetFns) {
        const index = sourceFns.findIndex(srcFn => srcFn._id == target._id);
        if (index != -1) {
          sourceFns[index].env = target.env;
        }
      }
    }

    const decider = new ObjectActionDecider(sourceFns, targetFns);

    this.inserts = decider.inserts();
    this.updates = decider.updates();
    this.deletes = decider.deletes();

    return {
      inserts: this.inserts,
      updates: this.updates,
      deletes: this.deletes
    };
  }

  async synchronize() {
    const insertPromises = this.inserts.map(fn =>
      this.targetService.post("function", fn).catch(e =>
        handleRejection({
          action: "insert",
          objectName: "function",
          message: e.message,
          objectId: fn.name
        })
      )
    );
    await spinUntilPromiseEnd(insertPromises, "Inserting functions to the target instance");

    const updatePromises = this.updates.map(fn =>
      this.targetService.put(`function/${fn._id}`, fn).catch(e =>
        handleRejection({
          action: "update",
          objectName: "function",
          message: e.message,
          objectId: fn.name
        })
      )
    );
    await spinUntilPromiseEnd(updatePromises, "Updating target instance functions");

    const deletePromises = this.deletes.map(fn =>
      this.targetService.delete(`function/${fn._id}`).catch(e =>
        handleRejection({
          action: "delete",
          objectName: "function",
          message: e.message,
          objectId: fn.name
        })
      )
    );
    await spinUntilPromiseEnd(deletePromises, "Deleting target instance functions");
  }

  getObjectName() {
    return this.moduleName;
  }
}

export class FunctionDependencySynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  primaryField = "name";

  inserts = [];
  updates = [];
  deletes = [];

  promises = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client,
    private fn: any
  ) {}

  initialize() {
    return Promise.resolve([]);
  }

  async analyze() {
    const deleteTypes = deps =>
      deps.map(d => {
        delete d.types;
        return d;
      });
    const sourceDeps = await this.sourceService
      .get<any[]>(`function/${this.fn._id}/dependencies`)
      .then(deleteTypes);

    const targetDeps = await this.targetService
      .get<any[]>(`function/${this.fn._id}/dependencies`)
      .then(deleteTypes)
      .catch(e => {
        if (e.statusCode == 404) {
          return [];
        }
        return Promise.reject(e.message);
      });

    const decider = new ObjectActionDecider(sourceDeps, targetDeps, "name");

    this.inserts = decider.inserts();
    this.updates = decider.updates();
    this.deletes = decider.deletes();

    return {
      inserts: this.inserts,
      updates: this.updates,
      deletes: this.deletes
    };
  }

  async synchronize() {
    const insertBody = [...this.inserts, ...this.updates].reduce(
      (acc, dep) => {
        const depName = `${dep.name}@${dep.version.slice(1)}`;
        acc.name.push(depName);
        return acc;
      },
      {name: []}
    );

    if (insertBody.name.length) {
      this.promises.push(
        this.targetService.post(`function/${this.fn._id}/dependencies`, insertBody)
      );
    }

    const deletePromises = this.deletes.map(dep =>
      this.targetService.delete(`function/${this.fn._id}/dependencies/${dep.name}`).catch(e =>
        handleRejection({
          action: "update",
          objectName: "function dependency",
          message: e.message,
          objectId: this.fn.name
        })
      )
    );

    if (deletePromises.length) {
      this.promises.push(...deletePromises);
    }

    return spinUntilPromiseEnd(this.promises, `Updating function '${this.fn.name}' dependencies`);
  }

  getObjectName() {
    return `${this.moduleName} '${this.fn.name}' dependency`;
  }
}

// export class ModuleSynchronizerTest {
//   private inserts = [];
//   private updates = [];
//   private deletes = [];

//   constructor(
//     private objectName: string,
//     private path: string,
//     private idField: string,
//     private sourceService: httpService.Client,
//     private targetService: httpService.Client,
//     private subModuleInitializer?: (...args) => Promise<ModuleSynchronizer[]>,
//     private applyOptionsBeforeComparison?: (
//       sourceObjects,
//       targetObjects
//     ) => {sourceObjects: []; targetObjects: []}
//   ) {}

//   initialize = this.subModuleInitializer || Promise.resolve;

//   async analyze() {
//     console.log();
//     let sourceObjects = await spin<any>({
//       text: `Fetching ${this.objectName}(s) from source instance`,
//       op: () => this.sourceService.get(this.path)
//     });

//     let targetObjects = await spin<any>({
//       text: `Fetching ${this.objectName}(s) from target instance`,
//       op: () => this.targetService.get(this.path)
//     });

//     if (typeof this.applyOptionsBeforeComparison == "function") {
//       const modifiedObjects = this.applyOptionsBeforeComparison(sourceObjects, targetObjects);
//       sourceObjects = modifiedObjects.sourceObjects;
//       targetObjects = modifiedObjects.targetObjects;
//     }

//     const decider = new ObjectActionDecider(sourceObjects, targetObjects);

//     this.inserts = decider.inserts();
//     this.updates = decider.updates();
//     this.deletes = decider.deletes();

//     return {
//       inserts: this.inserts,
//       updates: this.updates,
//       deletes: this.deletes
//     };
//   }

//   async synchronize() {
//     const insertPromises = this.inserts.map(object =>
//       this.targetService.post(this.path, object).catch(e =>
//         handleRejection({
//           action: "insert",
//           objectName: object,
//           message: e.message,
//           objectId: object[this.primaryField]
//         })
//       )
//     );
//     await spinUntilPromiseEnd(
//       insertPromises,
//       `Inserting ${this.objectName}(s) to the target instance`
//     );

//     const updatePromises = this.updates.map(object =>
//       this.targetService.put(`${this.path}/${object._id}`, object).catch(e =>
//         handleRejection({
//           action: "update",
//           objectName: object,
//           message: e.message,
//           objectId: object[this.primaryField]
//         })
//       )
//     );
//     await spinUntilPromiseEnd(
//       updatePromises,
//       `Updating ${this.objectName}(s) on the target instance`
//     );

//     const deletePromises = this.deletes.map(object =>
//       this.targetService.delete(`${this.path}/${object._id}`).catch(e =>
//         handleRejection({
//           action: "delete",
//           objectName: this.objectName,
//           message: e.message,
//           objectId: bucket.title
//         })
//       )
//     );
//     await spinUntilPromiseEnd(deletePromises, "Deleting bucket from the target instance");
//   }
// }

export class FunctionIndexSynchronizer implements ModuleSynchronizer {
  moduleName = "function";
  primaryField = "name";

  inserts = [];
  updates = [];
  deletes = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client
  ) {}

  initialize() {
    return Promise.resolve([]);
  }

  async analyze() {
    const sourceFns = await this.sourceService.get<any[]>("function");

    const sourceFnIndexes = await Promise.all(
      sourceFns.map(fn =>
        this.sourceService.get<any>(`function/${fn._id}/index`).then(res => {
          return {
            _id: fn._id,
            name: fn.name,
            index: res.index
          };
        })
      )
    );

    const targetFnIndexes = await Promise.all(
      sourceFns.map(fn =>
        this.targetService
          .get<any>(`function/${fn._id}/index`)
          .then(res => {
            return {
              _id: fn._id,
              name: fn.name,
              index: res.index
            };
          })
          .catch(e => {
            if (e.statusCode == 404) {
              return false;
            }
            return Promise.reject(e.message);
          })
      )
    ).then(indexes => indexes.filter(Boolean));

    const decider = new ObjectActionDecider(sourceFnIndexes, targetFnIndexes);

    this.inserts = decider.inserts();
    this.updates = decider.updates();
    this.deletes = decider.deletes();

    return {
      inserts: this.inserts,
      updates: this.updates,
      deletes: this.deletes
    };
  }

  synchronize() {
    // except others, we don't need to remove any function index because they are supposed to be deleted with function module synchronization
    const promises = [...this.inserts, ...this.updates].map(fn =>
      this.targetService.post(`function/${fn._id}/index`, {index: fn.index}).catch(e =>
        handleRejection({
          action: "insert",
          objectName: "function index",
          message: e.message,
          objectId: fn.name
        })
      )
    );

    return spinUntilPromiseEnd(promises, "Writing indexes to the target instance functions");
  }

  getObjectName() {
    return this.moduleName + " index";
  }
}

export class BucketSynchronizer implements ModuleSynchronizer {
  moduleName = "bucket";
  primaryField = "title";

  inserts = [];
  updates = [];
  deletes = [];

  constructor(
    private sourceService: httpService.Client,
    private targetService: httpService.Client
  ) {}

  initialize() {
    return Promise.resolve([]);
  }

  async analyze() {
    console.log();
    const sourceBuckets = await spin<any>({
      text: "Fetching buckets from source instance",
      op: () => this.sourceService.get("bucket")
    });

    const targetBuckets = await spin<any>({
      text: "Fetching buckets from target instance",
      op: () => this.targetService.get("bucket")
    });

    const decider = new ObjectActionDecider(sourceBuckets, targetBuckets);

    this.inserts = decider.inserts();
    this.updates = decider.updates();
    this.deletes = decider.deletes();

    return {
      inserts: this.inserts,
      updates: this.updates,
      deletes: this.deletes
    };
  }

  async synchronize() {
    const insertPromises = this.inserts.map(bucket =>
      this.targetService.post("bucket", bucket).catch(e =>
        handleRejection({
          action: "insert",
          objectName: "bucket",
          message: e.message,
          objectId: bucket.title
        })
      )
    );
    await spinUntilPromiseEnd(insertPromises, "Inserting buckets to the target instance");

    const updatePromises = this.updates.map(bucket =>
      this.targetService.put(`bucket/${bucket._id}`, bucket).catch(e =>
        handleRejection({
          action: "update",
          objectName: "bucket",
          message: e.message,
          objectId: bucket.title
        })
      )
    );
    await spinUntilPromiseEnd(updatePromises, "Updating buckets on the target instance");

    const deletePromises = this.deletes.map(bucket =>
      this.targetService.delete(`bucket/${bucket._id}`).catch(e =>
        handleRejection({
          action: "delete",
          objectName: "bucket",
          message: e.message,
          objectId: bucket.title
        })
      )
    );
    await spinUntilPromiseEnd(deletePromises, "Deleting bucket from the target instance");
  }

  getObjectName(): string {
    return this.moduleName;
  }
}

function printActions({inserts, updates, deletes, field, objectName}) {
  console.log();
  console.log(`----- ${objectName.toUpperCase()} -----`);
  console.log(
    `\n* Found ${bold(inserts.length)} objects to ${bold("insert")}: 
${inserts.map(i => `- ${i[field]}`).join("\n")}`
  );

  console.log(
    `\n* Found ${bold(updates.length)} objects to ${bold("update")}: 
${updates.map(i => `- ${i[field]}`).join("\n")}`
  );

  console.log(
    `\n* Found ${bold(deletes.length)} objects to ${bold("delete")}: 
${deletes.map(i => `- ${i[field]}`).join("\n")}`
  );
}

function spinUntilPromiseEnd(promises: Promise<any>[], label: string, paralel = true) {
  if (!promises.length) {
    return;
  }

  return spin({
    text: label,
    op: async spinner => {
      let progress = 0;
      let count = 0;

      if (paralel) {
        return Promise.all(
          promises.map(p =>
            p.then(() => {
              count++;
              progress = (100 / promises.length) * count;
              spinner.text = `${label} (%${Math.round(progress)})`;
            })
          )
        );
      }

      for (const promise of promises) {
        await promise;
        count++;
        progress = (100 / promises.length) * count;
        spinner.text = `${label} (%${Math.round(progress)})`;
      }
    }
  });
}

function handleRejection({action, objectName, objectId, message}) {
  return Promise.reject(`Failed to ${action} ${objectName} ${bold(objectId)}.
${message}`);
}
