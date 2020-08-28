import {Action} from "@spica-server/activity/services";
import {
  createBucketActivity,
  createBucketDataActivity
} from "@spica-server/bucket/src/activity.resource";

describe("Activity Resource", () => {
  describe("bucket", () => {
    it("should return activity from post request", () => {
      const res = {
        _id: "bucket_id"
      };

      const activities = createBucketActivity(
        {action: Action.POST, identifier: "test_user"},
        {},
        res
      );
      expect(activities).toEqual([
        {action: Action.POST, identifier: "test_user", resource: ["bucket", "bucket_id"]}
      ]);
    });

    it("should return activity from put request", () => {
      const req = {
        params: {
          id: "bucket_id"
        }
      };

      const activities = createBucketActivity(
        {action: Action.PUT, identifier: "test_user"},
        req,
        {}
      );
      expect(activities).toEqual([
        {action: Action.PUT, identifier: "test_user", resource: ["bucket", "bucket_id"]}
      ]);
    });

    it("should return activity from delete request", () => {
      const req = {
        params: {
          id: "bucket_id"
        }
      };

      const activities = createBucketActivity(
        {action: Action.DELETE, identifier: "test_user"},
        req,
        {}
      );
      expect(activities).toEqual([
        {action: Action.DELETE, identifier: "test_user", resource: ["bucket", "bucket_id"]}
      ]);
    });
  });
  describe("bucket-data", () => {
    it("should return activity from post request", () => {
      const req = {
        params: {
          bucketId: "bucket_id"
        }
      };
      const res = {
        _id: "bucket_data_id"
      };

      const activities = createBucketDataActivity(
        {action: Action.POST, identifier: "test_user"},
        req,
        res
      );
      expect(activities).toEqual([
        {
          action: Action.POST,
          identifier: "test_user",
          resource: ["bucket", "bucket_id", "data", "bucket_data_id"]
        }
      ]);
    });
    it("should return activity from put request", () => {
      const req = {
        params: {
          bucketId: "bucket_id",
          documentId: "bucket_data_id"
        }
      };
      const activities = createBucketDataActivity(
        {action: Action.PUT, identifier: "test_user"},
        req,
        {}
      );
      expect(activities).toEqual([
        {
          action: Action.PUT,
          identifier: "test_user",
          resource: ["bucket", "bucket_id", "data", "bucket_data_id"]
        }
      ]);
    });
    it("should return activity from single delete request", () => {
      const req = {
        params: {
          bucketId: "bucket_id",
          documentId: "bucket_data_id"
        }
      };
      const activities = createBucketDataActivity(
        {action: Action.DELETE, identifier: "test_user"},
        req,
        {}
      );
      expect(activities).toEqual([
        {
          action: Action.DELETE,
          identifier: "test_user",
          resource: ["bucket", "bucket_id", "data", "bucket_data_id"]
        }
      ]);
    });
    it("should return activity from multiple delete request", () => {
      const req = {
        params: {
          bucketId: "bucket_id"
        },
        body: ["bucket_data_id1", "bucket_data_id2"]
      };
      const activities = createBucketDataActivity(
        {action: Action.DELETE, identifier: "test_user"},
        req,
        {}
      );
      expect(activities).toEqual([
        {
          action: Action.DELETE,
          identifier: "test_user",
          resource: ["bucket", "bucket_id", "data", "bucket_data_id1"]
        },
        {
          action: Action.DELETE,
          identifier: "test_user",
          resource: ["bucket", "bucket_id", "data", "bucket_data_id2"]
        }
      ]);
    });
  });
});
