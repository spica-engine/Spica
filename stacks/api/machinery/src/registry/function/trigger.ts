import {JSONSchema7} from "json-schema";
import {ResourceDefinition} from "../../definition";

const TriggerV1: JSONSchema7 = {
  $schema: "http://json-schema.org/draft-07/schema",
  type: "object",
  required: ["name", "type", "func"],
  properties: {
    func: {
      type: "string"
    },
    name: {
      type: "string"
    },
    type: {
      type: "string",
      enum: ["http", "bucket", "schedule", "firehose", "system"]
    },
    batch: {
      type: "object",
      additionalProperties: false,
      required: ["deadline", "limit"],
      properties: {
        deadline: {
          type: "number",
          minimum: 1
        },
        limit: {
          type: "number",
          minimum: 2
        }
      }
    },
    scheduleOptions: {
      type: "object",
      required: ["cronSpec", "timezone"],
      additionalProperties: false,
      properties: {
        cronSpec: {
          type: "string"
        },
        timezone: {
          type: "string"
        }
      }
    },
    firehoseOptions: {
      type: "object",
      required: ["event"],
      additionalProperties: false,
      properties: {
        event: {
          type: "string"
        }
      }
    },
    httpOptions: {
      type: "object",
      required: ["method", "path"],
      additionalProperties: false,
      properties: {
        method: {
          type: "string"
        },
        path: {
          type: "string"
        },
        preflight: {
          type: "boolean",
          default: true
        }
      }
    },
    systemOptions: {
      type: "object",
      required: ["event"],
      additionalProperties: false,
      properties: {
        event: {
          type: "string",
          enum: ["READY"]
        }
      }
    },
    bucketOptions: {
      type: "object",
      additionalProperties: false,
      properties: {
        type: {
          enum: ["ALL", "INSERT", "UPDATE", "DELETE"]
        },
        bucket: {
          type: "object",
          properties: {
            resourceFieldRef: {
              type: "object",
              properties: {
                schemaName: {
                  type: "string"
                }
              }
            }
          }
        }
      }
    }
  }
};

export const Trigger: ResourceDefinition = {
  group: "function",
  names: {
    kind: "Trigger",
    plural: "triggers",
    singular: "trigger",
    shortNames: ["trigger"]
  },
  versions: [
    {
      name: "v1",
      schema: TriggerV1,
      current: true,
      additionalPrinterColumns: [
        {
          name: "TYPE",
          description: "Type of the trigger",
          jsonPath: ".spec.type",
          priority: 0,
          type: "string"
        },
        {
          name: "HANDLER",
          description: "Name of the handler to invoke",
          jsonPath: ".spec.name",
          priority: 0,
          type: "string"
        }
      ]
    }
  ]
};
