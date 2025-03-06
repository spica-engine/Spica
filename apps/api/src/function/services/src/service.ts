import {Inject, Injectable} from "@nestjs/common";
import {BaseCollection, DatabaseService, Filter, FindOptions} from "@spica-server/database";
import {EnvRelation, Function} from "@spica-server/interface/function";
import {FunctionOptions, FUNCTION_OPTIONS} from "./options";

@Injectable()
export class FunctionService extends BaseCollection<Function>("function") {
  constructor(database: DatabaseService, @Inject(FUNCTION_OPTIONS) options: FunctionOptions) {
    super(database, {entryLimit: options.entryLimit});
  }
}
