import {DynamicModule, Global, Inject, Module, Optional} from "@nestjs/common";
import {SchemaModule, Validator} from "@spica/core";
import {ApiKeyController} from "./apikey.controller";
import {ApiKeyService} from "./apikey.service";
import {ApiKeyStrategy} from "./apikey.strategy";
import {APIKEY_POLICY_FINALIZER} from "@spica/api/src/passport/policy";
import {providePolicyFinalizer} from "./utility";
import ApiKeySchema = require("./schemas/apikey.json");
import {ASSET_REP_MANAGER} from "@spica/api/src/asset/src/interface";
import {IRepresentativeManager} from "@spica/interface";
import {registerAssetHandlers} from "./asset";

@Global()
@Module({})
export class ApiKeyModule {
  constructor(
    as: ApiKeyService,
    validator: Validator,
    @Optional() @Inject(ASSET_REP_MANAGER) private assetRepManager: IRepresentativeManager
  ) {
    registerAssetHandlers(as, validator, assetRepManager);
  }
  static forRoot(): DynamicModule {
    return {
      module: ApiKeyModule,
      imports: [
        SchemaModule.forChild({
          schemas: [ApiKeySchema]
        })
      ],
      exports: [APIKEY_POLICY_FINALIZER],
      controllers: [ApiKeyController],
      providers: [
        ApiKeyService,
        ApiKeyStrategy,
        {
          provide: APIKEY_POLICY_FINALIZER,
          useFactory: providePolicyFinalizer,
          inject: [ApiKeyService]
        }
      ]
    };
  }
}
