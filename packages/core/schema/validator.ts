import {Inject, Injectable, Optional} from "@nestjs/common";
import {default as Ajv, ValidateFunction} from "ajv";
import formats from "ajv-formats";
import {ValidationError} from "ajv/dist/compile/error_classes";
import * as request from "request-promise-native";
import {from, isObservable} from "rxjs";
import {skip, take} from "rxjs/operators";
import defaultVocabulary from "./default";
import formatVocabulary from "./format";
import {
  Default,
  Format,
  GLOBAL_SCHEMA_MODULE_OPTIONS,
  Keyword,
  ModuleOptions,
  SCHEMA_MODULE_OPTIONS,
  UriResolver
} from "./interface";
export {CodeKeywordDefinition, ErrorObject, KeywordCxt, _} from "ajv";
export {ValidationError} from "ajv/dist/compile/error_classes";

@Injectable()
export class Validator {
  private _ajv: Ajv;
  private _resolvers = new Set<UriResolver>();
  private _defaults: Map<string, Default>;

  get defaults(): Default[] {
    return Array.from(this._defaults.values());
  }

  constructor(
    @Inject(SCHEMA_MODULE_OPTIONS) local: ModuleOptions = {},
    @Optional() @Inject(GLOBAL_SCHEMA_MODULE_OPTIONS) global: ModuleOptions = {}
  ) {
    this._defaults = new Map<string, Default>(
      [...(local.defaults || []), ...(global.defaults || [])].map(def => [def.match, def])
    );
    this._ajv = new Ajv({
      useDefaults: true,
      removeAdditional: true,
      loadSchema: uri => this._fetch(uri),
      formats: new Array<Format>()
        .concat(local.formats || [])
        .concat(global.formats || [])
        .reduce((formats, format) => {
          formats[format.name] = format;
          return formats;
        }, {}),
      schemas: new Array().concat(local.schemas || []).concat(global.schemas || []),
      strict: false,
      ["defaults" as any]: this._defaults
    });

    this.registerKeyword(defaultVocabulary);
    this.registerKeyword(formatVocabulary);

    for (const keyword of new Array<Keyword>()
      .concat(local.keywords || [])
      .concat(global.keywords || [])) {
      this.registerKeyword(keyword);
    }

    formats(this._ajv, {formats: ["regex"]});
  }

  private _fetch(uri: string): Promise<Object> {
    for (const interceptor of this._resolvers) {
      const result = interceptor(uri);
      if (!!result) {
        if (isObservable<Object>(result)) {
          result.pipe(skip(1)).subscribe({
            next: schema => {
              this._ajv.removeSchema(uri);
              this._ajv.addSchema(schema);
            },
            complete: () => this.removeSchema(uri)
          });
          return result.pipe(take(1)).toPromise();
        } else {
          return from(result).toPromise();
        }
      }
    }
    return request({uri, json: true}).catch(() =>
      Promise.reject(new Error(`Could not resolve the schema ${uri}`))
    );
  }

  registerUriResolver(uriResolver: UriResolver) {
    this._resolvers.add(uriResolver);
  }

  registerDefault(def: Default) {
    this._defaults.set(def.match, def);
  }

  registerKeyword(def: Keyword): void {
    this._ajv.removeKeyword(def.keyword as string);
    this._ajv.addKeyword(def);
  }

  removeSchema(schemaUri?: string) {
    this._ajv.removeSchema(schemaUri);
  }

  async validate<T = unknown>(schemaOrUrl: object | string, value: T): Promise<void> {
    let schema: object;
    if (typeof schemaOrUrl == "string") {
      schema = {$ref: schemaOrUrl};
    } else if (typeof schemaOrUrl == "object" && schemaOrUrl != null) {
      schema = schemaOrUrl;
    } else {
      throw new TypeError(`invalid schema type received ${typeof schemaOrUrl}`);
    }

    try {
      const validate = await this._ajv.compileAsync(schema);
      const valid = validate(value);
      if (!valid) {
        throw new ValidationError(validate.errors);
      }
    } catch (e) {
      throw e;
    }
  }
}
