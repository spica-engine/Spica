import {ObjectId} from "@spica-server/database";
import {Preference} from "@spica-server/preference/services";
import {JSONSchema7, JSONSchema7TypeName} from "json-schema";

export interface Bucket {
  _id?: ObjectId;
  title?: string;
  icon?: string;
  description?: string;
  primary: string;
  history?: boolean;
  readOnly?: boolean;
  properties?: {
    [key: string]: JSONSchema7 & PropertyOptions;
  };
  order?: number;
  required?: string[];
  acl: {
    read: string;
    write: string;
  };
}

interface PropertyOptions {
  type: JSONSchema7TypeName | JSONSchema7TypeName[] | string;
  options: {
    visible?: boolean;
    translate?: boolean;
    history?: boolean;
    position: "left" | "right" | "bottom";
  };
}

export interface BucketDocument {
  _id?: ObjectId;
  [key: string]: any | undefined;
}

export interface BucketPreferences extends Preference {
  _id?: any;
  language: {
    available: {
      [code: string]: string;
    };
    default: string;
  };
}
