import {ActionParameters, CreateCommandParameters, Command} from "@caporal/core";
import {Function, Triggers, Trigger} from "@spica-server/interface/function";
import axios from "axios";
import * as path from "path";
import * as fs from "fs";
import {spin} from "../../console";
import {FunctionCompiler} from "../../compile";
import {availableHttpServices, separateToNewLines} from "../../validator";
import {green} from "colorette";
import {FunctionWithIndex} from "../../function/interface";

async function orm({options}: ActionParameters) {
  const APIKEY = options.apikey as string;
  const APIURL = options.url as string;
  const PATH = (options.path as string) || path.join(process.cwd(), "functions");
  const TRIGGER_TYPES = options.triggerTypes as string[];
  const HTTP_SERVICE = options.httpService as string;

  await spin({
    text: "Fetching functions..",
    op: async spinner => {
      const config = {
        headers: {
          Authorization: `APIKEY ${APIKEY}`
        }
      };

      const functions = await axios
        .get<FunctionWithIndex[]>(APIURL + "/function", config)
        .then(r => {
          const fns = r.data;
          const promises = fns.map(fn =>
            axios.get(`${APIURL}/function/${fn._id}/index`, config).then(r => {
              fn.index = r.data.index;
            })
          );
          return Promise.all(promises).then(() => fns);
        });

      spinner.text = "Building interface and method definitions..";

      if (!fs.existsSync(PATH)) {
        fs.mkdirSync(PATH);
      }

      const writeFilePromises = [];
      for (const fn of functions) {
        const options = {
          http: {selectedService: HTTP_SERVICE}
        };
        const sources = new FunctionCompiler(fn, TRIGGER_TYPES, APIURL, options).compile();

        const replacedName = fn.name.replace(/ /gm, "_");
        const folderPath = path.join(PATH, replacedName);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath);
        }

        for (const source of sources) {
          const _path = path.join(folderPath, `index.${source.extension}`);

          writeFilePromises.push(fs.promises.writeFile(_path, source.content, {}));
        }
      }

      spinner.text = "Writing to the destination..";
      await Promise.all(writeFilePromises);

      spinner.text = `Succesfully completed! Folder url is ${PATH}`;
    }
  });
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand(
    "Create object relational mapping applied files to interact with Spica Cloud Functions"
  )
    .option("--url <url>", "Url of the API.", {required: true})
    .option("-a <apikey>, --apikey <apikey>", "Authorize via an API Key.", {required: true})
    .option(
      "--path <path>",
      "Full URL of the destination folder that the files will be created into. The current directory will be used as default"
    )
    .option(
      "--trigger-types <trigger-types>",
      "Trigger types that will be filtered. Default value is http.",
      {
        default: ["http"]
      }
    )
    .option(
      "--http-service <http-service>",
      `Third party library that is responsible for sending http requests. Available services are: ${separateToNewLines(
        availableHttpServices,
        green
      )}}.`,
      {
        default: "axios"
      }
    )
    .action(orm);
}
