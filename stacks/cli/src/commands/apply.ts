import {
  Action,
  ActionParameters,
  CaporalValidator,
  Command,
  CreateCommandParameters
} from "@caporal/core";
import * as fs from "fs";
import * as path from "path";
import * as YAML from "yaml";
import { request } from "../request";
import { formatFailureStatus, isFailureStatus } from "../status";
import { Resource } from "./api-resources";

async function apply({options}: ActionParameters) {
  const filename = path.normalize(options.filename as string);
  const documents = YAML.parseAllDocuments(fs.readFileSync(filename).toString());

  for (const document of documents) {
    const {apiVersion, kind, metadata, spec} = document.toJSON();

    const resourceList = await request.get<any>(`http://localhost:4300/apis/${apiVersion}`);

    if (isFailureStatus(resourceList)) {
      return console.error(formatFailureStatus(resourceList));
    }

    let resource;

    for (const _resource of resourceList.resources) {
      if (_resource.kind == kind) {
        resource = _resource;
      }
    }

    if (!resource) {
      return console.error(`the server doesn't have a resource type "${kind}"`);
    }

    // TODO: Handle this with a proper logic
    if (apiVersion == "function/v1" && kind == "Function") {
      const basePath = path.dirname(filename);
      spec.code = fs.readFileSync(path.resolve(basePath, spec.code)).toString();
    }

    let result = await request.post(`http://localhost:4300/apis/${apiVersion}/${resource.plural}`, {
      metadata,
      spec
    });

    let type: string = "created";

    if (isFailureStatus(result) && result.reason == "AlreadyExists") {
      const upstream = await request.get<Resource>(
        `http://localhost:4300/apis/${apiVersion}/${resource.plural}/${metadata.name}`
      );

      if (JSON.stringify(upstream.spec) == JSON.stringify(spec)) {
        type = "up-to date";
        result = {};
      } else {
        result = await request.put(
          `http://localhost:4300/apis/${apiVersion}/${resource.plural}/${metadata.name}`,
          {metadata, spec}
        );
        type = "replaced";
      }
    }

    if (isFailureStatus(result)) {
      return console.error(formatFailureStatus(result));
    }

    console.info(`${resource.singular} "${metadata.name}" ${type}.`);
  }
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Put objects to the API.")
    .option("-f, --filename", "that contains the configuration to apply", {
      required: true,
      validator: CaporalValidator.STRING
    })
    .action((apply as unknown) as Action);
}
