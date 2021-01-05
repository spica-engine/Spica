import * as Bucket from "@spica-devkit/bucket";
import * as Operators from "../src/operators";
import {http} from "@spica-devkit/internal_common";
import {of} from "rxjs";

jasmine.getEnv().allowRespy(true);

describe("@spica-devkit/bucket", () => {
  let getSpy: jasmine.SpyObj<any>;
  let postSpy: jasmine.SpyObj<any>;
  let putSpy: jasmine.SpyObj<any>;
  let deleteSpy: jasmine.SpyObj<any>;
  let wsSpy: jasmine.SpyObj<any>;

  beforeEach(() => {
    process.env.__INTERNAL__SPICA__PUBLIC_URL__ = "http://test";
    Bucket.initialize({apikey: "TEST_APIKEY"});

    getSpy = spyOn(http, "get").and.returnValue(Promise.resolve());
    postSpy = spyOn(http, "post").and.returnValue(Promise.resolve());
    putSpy = spyOn(http, "put").and.returnValue(Promise.resolve());
    deleteSpy = spyOn(http, "del").and.returnValue(Promise.resolve());

    wsSpy = spyOn(Operators, "getWsObs").and.returnValue(of());
  });

  describe("errors", () => {
    it("should throw error when public url parameter and internal public url are missing", async () => {
      delete process.env.__INTERNAL__SPICA__PUBLIC_URL__;
      expect(() => Bucket.initialize({apikey: "TEST_APIKEY"})).toThrowError(
        "Public url must be provided."
      );
    });
  });

  describe("bucket", () => {
    const bucket: Bucket.Bucket = {
      title: "User Bucket",
      description: "User Bucket Description",
      primary: "name",
      properties: {
        name: {
          type: "string",
          title: "name",
          options: {position: "left", visible: true}
        },
        surname: {
          type: "string",
          title: "surname",
          options: {position: "right"}
        }
      }
    };

    it("should insert bucket", () => {
      Bucket.insert(bucket);

      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith("http://test/bucket", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
        body: JSON.stringify(bucket)
      });
    });

    it("should update bucket", () => {
      const updatedBucket = {...bucket, title: "new title"};
      Bucket.update("bucket_id", updatedBucket);

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(putSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
        body: JSON.stringify(updatedBucket)
      });
    });

    it("should get all buckets", () => {
      Bucket.getAll();

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("http://test/bucket", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should get specific bucket", () => {
      Bucket.get("bucket_id");

      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    it("should remove bucket", () => {
      Bucket.remove("bucket_id");

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id", {
        headers: {Authorization: "APIKEY TEST_APIKEY"}
      });
    });

    describe("bucket-data", () => {
      const document: Bucket.BucketDocument = {
        name: "name",
        surname: "surname"
      };

      it("should insert bucket-data", () => {
        Bucket.data.insert("bucket_id", document);

        expect(postSpy).toHaveBeenCalledTimes(1);
        expect(postSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id/data", {
          headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
          body: JSON.stringify(document)
        });
      });

      it("should update bucket-data", () => {
        Bucket.data.update("bucket_id", "document_id", document);

        expect(putSpy).toHaveBeenCalledTimes(1);
        expect(putSpy).toHaveBeenCalledWith("http://test/bucket/bucket_id/data/document_id", {
          headers: {Authorization: "APIKEY TEST_APIKEY", "Content-Type": "application/json"},
          body: JSON.stringify(document)
        });
      });

      it("should get bucket-data", () => {
        Bucket.data.get("bucket_id", "document_id");

        const url = new URL("http://test/bucket/bucket_id/data/document_id");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith(url, {
          headers: {Authorization: "APIKEY TEST_APIKEY"}
        });
      });

      it("should get bucket-data with params", () => {
        Bucket.data.get("bucket_id", "document_id", {
          headers: {"accept-language": "TR"},
          queryParams: {relation: true}
        });

        const url = new URL("http://test/bucket/bucket_id/data/document_id?relation=true");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith(url, {
          headers: {"accept-language": "TR", Authorization: "APIKEY TEST_APIKEY"}
        });
      });

      it("should get all bucket-data", () => {
        Bucket.data.getAll("bucket_id");

        const url = new URL("http://test/bucket/bucket_id/data");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith(url, {
          headers: {
            Authorization: "APIKEY TEST_APIKEY"
          }
        });
      });

      it("should get all bucket-data with params", () => {
        Bucket.data.getAll("bucket_id", {
          headers: {"accept-language": "TR"},
          queryParams: {limit: 1, skip: 2}
        });

        const url = new URL("http://test/bucket/bucket_id/data?limit=1&skip=2");

        expect(getSpy).toHaveBeenCalledTimes(1);
        expect(getSpy).toHaveBeenCalledWith(url, {
          headers: {
            Authorization: "APIKEY TEST_APIKEY",
            "accept-language": "TR"
          }
        });
      });
    });

    describe("bucket-data realtime", () => {
      describe("getAll", () => {
        it("should get all bucket-data", () => {
          Bucket.data.realtime.getAll("bucket_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined);
        });

        it("should get all with filter", () => {
          Bucket.data.realtime.getAll("bucket_id", {
            filter: "name=='test'"
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", "name=='test'");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined);
        });

        it("should get all with sort", () => {
          const sort = {age: 1};

          Bucket.data.realtime.getAll("bucket_id", {
            sort
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("sort", JSON.stringify(sort));
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), sort);
        });

        it("should get all with limit and skip", () => {
          Bucket.data.realtime.getAll("bucket_id", {
            limit: 1,
            skip: 1
          });

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("limit", "1");
          url.searchParams.append("skip", "1");
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString(), undefined);
        });
      });

      describe("get", () => {
        it("should get specific bucket-data", () => {
          Bucket.data.realtime.get("bucket_id", "document_id");

          const url = new URL("ws://test/bucket/bucket_id/data");
          url.searchParams.append("filter", '_id=="document_id"');
          url.searchParams.append("Authorization", "APIKEY TEST_APIKEY");

          expect(wsSpy).toHaveBeenCalledTimes(1);
          expect(wsSpy).toHaveBeenCalledWith(url.toString());
        });
      });
    });
  });
});
