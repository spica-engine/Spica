import {ObjectId} from "@spica-server/database";
import {FunctionService} from "@spica-server/function/services";
import {IRepresentativeManager, SyncProvider} from "@spica-server/versioncontrol";
import {FunctionEngine} from "../engine";

export function dependecySyncProviders(
  service: FunctionService,
  manager: IRepresentativeManager,
  engine: FunctionEngine
): SyncProvider {
  const name = "function-dependency";
  const module = "function";

  const getAll = async () => {
    const fns = await service.find();
    const promises = [];

    const dependencies = [];
    for (const fn of fns) {
      const promise = engine.getPackages(fn).then(deps => {
        const depsDef = deps.reduce((acc, curr) => {
          acc[curr.name] = curr.version;
          return acc;
        }, {});
        deps = deps.map(d => {
          delete d.types;
          return d;
        });
        dependencies.push({_id: fn._id.toString(), dependencies: depsDef});
      });

      promises.push(promise);
    }

    return Promise.all(promises).then(() => dependencies);
  };

  const reinstall = async fn => {
    await service.findOne({_id: new ObjectId(fn._id)});

    const oldDeps = await engine.getPackages(fn);

    await Promise.all(oldDeps.map(dep => engine.removePackage(fn, dep.name)));

    const newDeps = Object.entries(fn.dependencies).map(([name, version]) => {
      return `${name}@${(version as string).slice(1)}`;
    });

    await engine.addPackage(fn, newDeps).toPromise();

    return fn;
  };

  const uninstall = async fn => {
    const deps = await engine.getPackages(fn);
    await Promise.all(deps.map(dep => engine.removePackage(fn, dep.name)));
  };

  const document = {
    getAll,
    insert: reinstall,
    update: reinstall,
    delete: uninstall
  };

  const readAll = async () => {
    const resourceNameValidator = str => ObjectId.isValid(str);
    const files = await manager.read(module, resourceNameValidator, ["package.json"]);
    return files.map(file => {
      return {_id: file._id, dependencies: file.contents.package.dependencies};
    });
  };

  const write = fn => {
    return manager.write(
      module,
      fn._id.toString(),
      "package",
      {dependencies: fn.dependencies},
      "json"
    );
  };

  const rm = () => Promise.resolve();

  const representative = {
    getAll: readAll,
    insert: write,
    update: write,
    delete: rm
  };

  return {
    name,
    document,
    representative,
    parents: 1
  };
}
