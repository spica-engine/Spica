import {createFileContent} from "@spica/cli";

describe("ORM", () => {
  const bucketAllTypes = {
    _id: "614085d7d54da7002d0f52df",
    title: "New Bucket",
    description: "Describe your new bucket",
    icon: "view_stream",
    primary: "title",
    readOnly: false,
    history: false,
    properties: {
      title: {
        type: "string",
        title: "title",
        description: "Title of the row",
        options: {position: "left"}
      },
      description: {
        type: "textarea",
        title: "description",
        description: "Description of the row",
        options: {position: "right"}
      },
      date: {
        type: "date",
        title: "date",
        description: "Description of the date input",
        options: {position: "bottom"}
      },
      number: {
        type: "number",
        title: "number",
        description: "Description of the number input",
        options: {position: "bottom"},
        enum: [1, 2, 6123]
      },
      boolean: {
        type: "boolean",
        title: "boolean",
        description: "Description of the boolean input",
        options: {position: "bottom"},
        default: false
      },
      array: {
        type: "array",
        title: "array",
        description: "Description of the array input",
        options: {position: "bottom"},
        items: {title: "Title of the items", type: "string"}
      },
      multiselect: {
        type: "multiselect",
        title: "multiselect",
        description: "Description of the multiselect input",
        options: {position: "bottom"},
        items: {type: "string", enum: ["test", "test333"]}
      },
      object: {
        type: "object",
        title: "object",
        description: "Description of the object input",
        options: {position: "bottom"},
        properties: {
          string: {
            type: "string",
            title: "string",
            description: "Description of the string input",
            options: {position: "bottom"}
          }
        }
      },
      color: {
        type: "color",
        title: "color",
        description: "Description of the color input",
        options: {position: "bottom"}
      },
      storage: {
        type: "storage",
        title: "storage",
        description: "Description of the storage input",
        options: {position: "bottom"}
      },
      relationmany: {
        type: "relation",
        title: "relationmany",
        description: "Description of the relationmany input",
        options: {position: "bottom"},
        relationType: "onetomany",
        bucketId: "614085d7d54da7002d0f52df",
        dependent: false
      },
      richtext: {
        type: "richtext",
        title: "richtext",
        description: "Description of the richtext input",
        options: {position: "bottom"}
      },
      location: {
        type: "location",
        title: "location",
        description: "Description of the location input",
        options: {position: "bottom"},
        locationType: "Point"
      }
    },
    acl: {write: "true==true", read: "true==true"},
    order: 3
  } as any;

  it("should create file content for bucket which includes all available types", () => {
    const content = createFileContent([bucketAllTypes], "APIKEY", "APIURL", []);
    const expectation = `import * as Bucket from '@spica-devkit/bucket';
/**
 * Call this method before interacting with buckets.
 * @param initOptions Initialize options to initialize the '@spica-devkit/bucket'.
 */
export function initialize(
  ...initOptions: Parameters<typeof Bucket.initialize>
) {
  initOptions[0].publicUrl = 'APIURL';
  Bucket.initialize(...initOptions);
}

type Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;
type getArgs = Rest<Parameters<typeof Bucket.data.get>>;
type getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;
type realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;
type realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;

interface New_Bucket{
  _id: string;
  title?: string;
  description?: string;
  date?: Date | string;
  number?: (1|2|6123);
  boolean?: boolean;
  array?: string[];
  multiselect?: ('test'|'test333')[];
  object?: {
  string?: string;};
  color?: string;
  storage?: string;
  relationmany?: (New_Bucket | string)[];
  richtext?: string;
  location?: { type: "Point", coordinates: [number,number]};
}
export namespace new_bucket {
  const BUCKET_ID = '614085d7d54da7002d0f52df';
    export function get (...args: getArgs) {
      return Bucket.data.get<New_Bucket>(BUCKET_ID, ...args);
    };
    export function getAll (...args: getAllArgs) {
      return Bucket.data.getAll<New_Bucket>(BUCKET_ID, ...args);
    };
    export function insert (document: Omit<New_Bucket, '_id'>) {
      ['relationmany'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: New_Bucket) {
      ['relationmany'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<New_Bucket>, '_id'> & { _id: string }
    ) {
      ['relationmany'].forEach((field) => {
        if (typeof document[field] == 'object') {
          document[field] = Array.isArray(document[field])
            ? document[field].map((v) => v._id)
            : document[field]._id;
        }
      });
      return Bucket.data.patch(BUCKET_ID, document._id, document);
    };  
    export function remove (documentId: string) {
      return Bucket.data.remove(BUCKET_ID, documentId);
    };
  export namespace realtime {
      export function get (...args: realtimeGetArgs) {
        return Bucket.data.realtime.get<New_Bucket>(BUCKET_ID, ...args);
      };
      export function getAll (...args: realtimeGetAllArgs) {
        return Bucket.data.realtime.getAll<New_Bucket>(BUCKET_ID, ...args);
      };
  }
}`;

    expect(content).toEqual(expectation);
  });

  it("should put number suffix and create warning if buckets have the same tilte", () => {
    const bucket1 = {_id: "id1", title: "Users", properties: {title: {type: "string"}}};
    const bucket2 = {_id: "id2", title: "Users", properties: {name: {type: "string"}}};

    const warnings = [];
    const content = createFileContent([bucket1, bucket2] as any, "APIKEY", "APIURL", warnings);
    const expectation = `import * as Bucket from '@spica-devkit/bucket';
/**
 * Call this method before interacting with buckets.
 * @param initOptions Initialize options to initialize the '@spica-devkit/bucket'.
 */
export function initialize(
  ...initOptions: Parameters<typeof Bucket.initialize>
) {
  initOptions[0].publicUrl = 'APIURL';
  Bucket.initialize(...initOptions);
}

type Rest<T extends any[]> = ((...p: T) => void) extends ((p1: infer P1, ...rest: infer R) => void) ? R : never;
type getArgs = Rest<Parameters<typeof Bucket.data.get>>;
type getAllArgs = Rest<Parameters<typeof Bucket.data.getAll>>;
type realtimeGetArgs = Rest<Parameters<typeof Bucket.data.realtime.get>>;
type realtimeGetAllArgs = Rest<Parameters<typeof Bucket.data.realtime.getAll>>;

interface Users{
  _id: string;
  title?: string;
}
export namespace users {
  const BUCKET_ID = 'id1';
    export function get (...args: getArgs) {
      return Bucket.data.get<Users>(BUCKET_ID, ...args);
    };
    export function getAll (...args: getAllArgs) {
      return Bucket.data.getAll<Users>(BUCKET_ID, ...args);
    };
    export function insert (document: Omit<Users, '_id'>) {
      
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: Users) {
      
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<Users>, '_id'> & { _id: string }
    ) {
      
      return Bucket.data.patch(BUCKET_ID, document._id, document);
    };  
    export function remove (documentId: string) {
      return Bucket.data.remove(BUCKET_ID, documentId);
    };
  export namespace realtime {
      export function get (...args: realtimeGetArgs) {
        return Bucket.data.realtime.get<Users>(BUCKET_ID, ...args);
      };
      export function getAll (...args: realtimeGetAllArgs) {
        return Bucket.data.realtime.getAll<Users>(BUCKET_ID, ...args);
      };
  }
}

interface Users2{
  _id: string;
  name?: string;
}
export namespace users2 {
  const BUCKET_ID = 'id2';
    export function get (...args: getArgs) {
      return Bucket.data.get<Users2>(BUCKET_ID, ...args);
    };
    export function getAll (...args: getAllArgs) {
      return Bucket.data.getAll<Users2>(BUCKET_ID, ...args);
    };
    export function insert (document: Omit<Users2, '_id'>) {
      
      return Bucket.data.insert(BUCKET_ID, document);
    };
    export function update (document: Users2) {
      
      return Bucket.data.update(
        BUCKET_ID,
        document._id,
        document
      );
    };  
    export function patch (
      document: Omit<Partial<Users2>, '_id'> & { _id: string }
    ) {
      
      return Bucket.data.patch(BUCKET_ID, document._id, document);
    };  
    export function remove (documentId: string) {
      return Bucket.data.remove(BUCKET_ID, documentId);
    };
  export namespace realtime {
      export function get (...args: realtimeGetArgs) {
        return Bucket.data.realtime.get<Users2>(BUCKET_ID, ...args);
      };
      export function getAll (...args: realtimeGetAllArgs) {
        return Bucket.data.realtime.getAll<Users2>(BUCKET_ID, ...args);
      };
  }
}`;

    expect(content).toEqual(expectation);
    expect(warnings).toEqual([
      `It seems there is more than one bucket that has the title 'Users'. 
Number suffix will be added but should use unique titles for the best practice.`
    ]);
  });
});
