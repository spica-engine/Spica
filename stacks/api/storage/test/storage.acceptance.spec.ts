import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {StorageModule} from "@spica-server/storage";
import * as BSON from "bson";
import * as etag from "etag";
import {StorageObject} from "@spica-server/storage/src/body";

describe("Storage Acceptance", () => {
  let app: INestApplication;
  let req: Request;

  async function addTextObjects() {
    const first = {
      name: `first.txt`,
      content: {
        data: new BSON.Binary(Buffer.from("first")),
        type: `text/plain`
      }
    };

    const second = {
      name: `second.txt`,
      content: {
        data: new BSON.Binary(Buffer.from("second")),
        type: `text/plain`
      }
    };

    const third = {
      name: `third.txt`,
      content: {
        data: new BSON.Binary(Buffer.from("third")),
        type: `text/plain`
      }
    };

    return await req.post("/storage", BSON.serialize({content: [first, second, third]}), {
      "Content-Type": "application/bson"
    });
  }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        PassportTestingModule.initialize(),
        DatabaseTestingModule.standalone(),
        StorageModule.forRoot({
          defaultPath: process.env.TEST_TMPDIR,
          defaultPublicUrl: "http://insteadof",
          strategy: "default",
          objectSizeLimit: 0.1
        })
      ]
    }).compile();
    app = module.createNestApplication(undefined, {
      bodyParser: false
    });
    req = module.get(Request);
    await app.listen(req.socket);

    await addTextObjects();

    jasmine.addCustomEqualityTester((actual, expected) => {
      if (expected == "__skip__" && typeof actual == typeof expected) {
        return true;
      }
      if (expected == "__skip_if_valid_url__" && typeof actual == typeof expected) {
        return /http:\/\/insteadof\/storage\/.*?\/view/.test(actual);
      }
      return undefined;
    });
  });

  describe("index", () => {
    it("should work with limit", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {limit: "1", sort: JSON.stringify({_id: -1})});

      expect(meta.total).toBe(3);
      expect(data).toEqual([
        {
          _id: "__skip__",
          name: "third.txt",
          url: `http://insteadof/storage/${data[0]._id}/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with skip", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {skip: "1", sort: JSON.stringify({_id: -1})});

      expect(meta.total).toBe(3);
      expect(data).toEqual([
        {
          _id: "__skip__",
          name: "second.txt",
          url: `http://insteadof/storage/${data[0]._id}/view`,
          content: {
            type: `text/plain`,
            size: 6
          }
        },
        {
          _id: "__skip__",
          name: "first.txt",
          url: `http://insteadof/storage/${data[1]._id}/view`,
          content: {
            type: `text/plain`,
            size: 5
          }
        }
      ]);
    });

    it("should work with skip and limit query", async () => {
      const {
        body: {meta, data}
      } = await req.get("/storage", {skip: "1", limit: "1", sort: JSON.stringify({_id: -1})});

      expect(meta.total).toBe(3);
      expect(data).toEqual([
        {
          _id: "__skip__",
          name: "second.txt",
          url: `http://insteadof/storage/${data[0]._id}/view`,
          content: {
            type: `text/plain`,
            size: 6
          }
        }
      ]);
    });

    describe("sort", () => {
      it("ascend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          sort: JSON.stringify({name: 1})
        });

        expect(meta.total).toBe(3);
        expect(data).toEqual([
          {
            _id: "__skip__",
            name: "first.txt",
            url: `http://insteadof/storage/${data[0]._id}/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: "__skip__",
            name: "second.txt",
            url: `http://insteadof/storage/${data[1]._id}/view`,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: "__skip__",
            name: "third.txt",
            url: `http://insteadof/storage/${data[2]._id}/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          }
        ]);
      });

      it("descend by name", async () => {
        const {
          body: {meta, data}
        } = await req.get("/storage", {
          sort: JSON.stringify({name: -1})
        });

        expect(meta.total).toBe(3);
        expect(data).toEqual([
          {
            _id: "__skip__",
            name: "third.txt",
            url: `http://insteadof/storage/${data[0]._id}/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          },
          {
            _id: "__skip__",
            name: "second.txt",
            url: `http://insteadof/storage/${data[1]._id}/view`,
            content: {
              type: `text/plain`,
              size: 6
            }
          },
          {
            _id: "__skip__",
            name: "first.txt",
            url: `http://insteadof/storage/${data[2]._id}/view`,
            content: {
              type: `text/plain`,
              size: 5
            }
          }
        ]);
      });
    });
  });

  describe("find", () => {
    it("should return storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const {body: response} = await req.get(`/storage/${row._id}`);
      expect(response._id).toEqual(row._id);
      expect(response.url).toEqual(row.url);
      expect(response.name).toEqual(row.name);
    });
  });

  describe("show", () => {
    it("should send 304 status if object etag matches if-none-match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      const {statusCode, statusText} = await req.get(
        `/storage/${row._id}/view`,
        {},

        {"If-None-Match": etag("third")}
      );
      expect(statusCode).toBe(304);
      expect(statusText).toBe("Not Modified");
    });

    it("should show the object if if-none-match does not match", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      const {headers, body} = await req.get(
        `/storage/${row._id}/view`,
        {},
        {"If-None-Match": etag("unexist content")}
      );
      expect(headers["content-type"]).toEqual("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("third"));
      expect(body).toBe("third");
    });

    it("should send the ETag", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      const {headers} = await req.get(`/storage/${row._id}/view`);
      expect(headers["content-type"]).toBe("text/plain; charset=utf-8");
      expect(headers["etag"]).toBe(etag("third"));
    });
  });

  describe("put", () => {
    it("should show updated storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      row.content.data = new BSON.Binary(Buffer.from("new data"));
      await req.put(`/storage/${row._id}`, BSON.serialize(row), {
        "Content-Type": "application/bson"
      });

      const {body} = await req.get(`/storage/${row._id}/view`);

      expect(body).toBe("new data");
    });

    it("should throw an error if updated data is empty", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      const {statusCode, statusText, body: __} = await req.put(
        `/storage/${row._id}`,
        BSON.serialize(row),
        {
          "Content-Type": "application/bson"
        }
      );
      expect(statusCode).toEqual(400);
      expect(statusText).toEqual("Bad Request");

      const {body} = await req.get(`/storage/${row._id}/view`);
      expect(body).toBe("third");
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const size = 0.2 * 1024 * 1024;
      row.content.data = new BSON.Binary(Buffer.alloc(size, "f"));
      const {statusCode, statusText} = await req.put(`/storage/${row._id}`, BSON.serialize(row), {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });

  describe("post", () => {
    it("should insert single storage object", async () => {
      const data: StorageObject<BSON.Binary> = {
        name: "remoteconfig.json",
        content: {
          data: new BSON.Binary(Buffer.from("{}")),
          type: "application/json"
        }
      };
      const {body, statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: [data]}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remoteconfig.json",
          url: "__skip_if_valid_url__",
          content: {
            type: "application/json",
            size: 2
          }
        }
      ]);
      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should insert storage objects", async () => {
      const objects = [
        {
          name: "remote config.json",
          content: {
            data: new BSON.Binary(Buffer.from("{}")),
            type: "application/json"
          }
        },
        {
          name: "remote config backup.json",
          content: {
            data: new BSON.Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText, body} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remote config.json",
          url: "__skip_if_valid_url__",
          content: {
            size: 2,
            type: "application/json"
          }
        },
        {
          _id: "__skip__",
          name: "remote config backup.json",
          url: "__skip_if_valid_url__",
          content: {
            size: 2,
            type: "application/json"
          }
        }
      ]);

      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should throw an error if the inserted object's data is empty", async () => {
      const objects = [
        {
          name: "invalid.json",
          content: {
            data: null,
            type: "application/json"
          }
        },
        {
          name: "valid.json",
          content: {
            data: new BSON.Binary(Buffer.from("[]")),
            type: "application/json"
          }
        }
      ];
      const {statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );

      expect(statusCode).toBe(400);
      expect(statusText).toBe("Bad Request");

      const {body: upstreamObjects} = await req.get("/storage");
      expect(upstreamObjects.data.length).toBe(3);
    });

    it("should throw an error if the inserted data is larger than the object size limit", async () => {
      const size = 0.2 * 1024 * 1024;
      const objects = [
        {
          name: "password.txt",
          content: {
            data: new BSON.Binary(Buffer.alloc(size, "f")),
            type: "text/plain"
          }
        }
      ];
      const {statusCode, statusText} = await req.post(
        "/storage",
        BSON.serialize({content: objects}),
        {
          "Content-Type": "application/bson"
        }
      );
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });

  describe("delete", () => {
    it("should delete storage object", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage");

      const response = await req.delete(`/storage/${row._id}`);
      expect(response.statusCode).toBe(204);
      expect(response.statusText).toBe("No Content");
      expect(response.body).toBe(undefined);

      const {body: storageObjects} = await req.get("/storage");
      expect(storageObjects.meta.total).toBe(2);
      expect(storageObjects.data.length).toEqual(2);

      const deletedStorageObjectResponse = await req.get(`/storage/${row._id}`);
      expect(deletedStorageObjectResponse.statusCode).toBe(404);
      expect(deletedStorageObjectResponse.statusText).toBe("Not Found");
    });
  });

  describe("application/json", () => {
    it("should insert single storage object", async () => {
      const object: StorageObject<string> = {
        name: "remoteconfig.json",
        content: {
          data: Buffer.from("{}").toString("base64"),
          type: "application/json"
        }
      };
      const {body, statusCode, statusText} = await req.post("/storage", [object]);

      expect(body).toEqual([
        {
          _id: "__skip__",
          name: "remoteconfig.json",
          url: "__skip_if_valid_url__",
          content: {
            type: "application/json",
            size: 2
          }
        }
      ]);
      expect(statusCode).toBe(201);
      expect(statusText).toBe("Created");
    });

    it("should update the storage object", async () => {
      const {
        body: {
          data: [row]
        },
        headers: {["etag"]: prevETag}
      } = await req.get("/storage", {sort: JSON.stringify({_id: -1})});
      row.content.data = Buffer.from("new data").toString("base64");
      await req.put(`/storage/${row._id}`, row);
      const {
        body,
        headers: {["etag"]: ETag}
      } = await req.get(`/storage/${row._id}/view`);
      expect(body).toBe("new data");
      expect(prevETag).not.toBe(ETag);
    });

    it("should throw an error if the updated data is larger than the object size limit", async () => {
      const {
        body: {
          data: [row]
        }
      } = await req.get("/storage", {});
      const size = 0.2 * 1024 * 1024;
      row.content.data = Buffer.alloc(size, "f").toString("base64");
      const {statusCode, statusText, body} = await req.put(`/storage/${row._id}`, [row]);
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });

    it("should throw an error if the inserted data is larger than the object size limit", async () => {
      const size = 0.2 * 1024 * 1024;
      const object: StorageObject<string> = {
        name: "password.txt",
        content: {
          data: Buffer.alloc(size, "f").toString("base64"),
          type: "text/plain"
        }
      };
      const {statusCode, statusText} = await req.post("/storage", [object], {
        "Content-Type": "application/bson"
      });
      expect(statusCode).toBe(413);
      expect(statusText).toBe("Payload Too Large");
    });
  });
});
