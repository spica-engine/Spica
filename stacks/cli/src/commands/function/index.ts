import {Namespace, NamespaceMetadata, NamespaceMap} from "@ionic/cli-framework";
import {DependencyNamespace} from "./dependency";

export class FunctionNamespace extends Namespace {
  async getMetadata(): Promise<NamespaceMetadata> {
    return {
      name: "function",
      summary: "All commands about the function module."
    };
  }

  async getNamespaces(): Promise<NamespaceMap> {
    return new NamespaceMap([["dependency", async () => new DependencyNamespace()]]);
  }
}
