import {InjectionToken} from "@angular/core";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface InputSchema extends JSONSchema7 {
  type: JSONSchema7TypeName | any;
}

export interface InternalPropertySchema extends InputSchema {
  $required: boolean;
  $name: string;
}

export interface SchemaPlacerOptions {
  title: boolean;
}

export interface InputPlacerOptions {
  [key: string]: any;
}

export const INPUT_SCHEMA = new InjectionToken<InputSchema>("INPUT_SCHEMA");

export const INPUT_SCHEMA_OPTIONS = new InjectionToken<any>("INPUT_SCHEMA_OPTIONS");

export const INPUT_OPTIONS = new InjectionToken<any>("INPUT_OPTIONS");

export interface InputPlacerWithMetaPlacer {
  origin: JSONSchema7TypeName;
  type: string;
  placer: any;
  metaPlacer?: any;
  coerce?: () => any;
}

export const INPUT_PLACERS = new InjectionToken<InputPlacerWithMetaPlacer[]>("INPUT_PLACERS");

export const EMPTY_INPUT_SCHEMA: InputSchema = {
  title: undefined,
  type: undefined
};
