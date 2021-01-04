import {cosmiconfig} from "cosmiconfig";
import * as fs from "fs";
import * as os from "os";
import * as _path from "path";

export namespace config {
  export interface Config {
    context: string;
  }

  const explorer = cosmiconfig("spica", {
    searchPlaces: [
      `.spicarc`,
      `.spicarc.json`,
      `.spicarc.yaml`,
      `.spicarc.yml`,
      `.spicarc.js`,
      `.spicarc.cjs`
    ]
  });

  export async function get(): Promise<Config> {
    let config = await explorer.search(process.cwd());
    if (!config) {
      config = await explorer.search(os.homedir());
    }

    if (!config) {
      return {context: undefined};
    }
    return config.config;
  }

  export async function path(): Promise<string | undefined> {
    let config = await explorer.search(process.cwd());
    if (!config) {
      config = await explorer.search(os.homedir());
    }

    if (config) {
      return config.filepath;
    }
    return undefined;
  }

  export async function set(config: Config) {
    let configPath = await path();
    if (!configPath) {
      configPath = _path.join(os.homedir(), ".spicarc");
    }
    fs.writeFileSync(configPath, JSON.stringify(config, undefined, 2));
  }
}
