import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportModule} from "@spica-server/passport";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("ApiKey", () => {
  let req: Request;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.create(),
        CoreTestingModule,
        PreferenceTestingModule,
        PassportModule.forRoot({
          issuer: "spica.internal",
          secretOrKey: "test",
          defaultStrategy: "noop"
        }),
        PassportTestingModule.initialize()
      ]
    }).compile();

    req = module.get(Request);

    app = module.createNestApplication();

    await app.listen(req.socket);
  });

  afterEach(async () => await app.close());

  describe("find", () => {
    it("should return empty index", async () => {
      const res = await req.get("/passport/apikey", undefined);
      expect(res.body).toEqual({
        meta: {total: 0},
        data: []
      });
    });

    it("should not return empty index", async () => {
      const {body: apiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });
      const res = await req.get("/passport/apikey", undefined);
      expect(res.body).toEqual({
        data: [apiKey],
        meta: {total: 1}
      });
    });

    it("should sort", async () => {
      const {body: firstKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: secondKey} = await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {sort: JSON.stringify({name: -1})});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [secondKey, firstKey]
      });
    });

    it("should skip", async () => {
      await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: secondKey} = await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {skip: 1});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [secondKey]
      });
    });

    it("should limit", async () => {
      const {body: firstKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      await req.post("/passport/apikey", {
        name: "test1",
        description: "test1"
      });

      const {body: keys} = await req.get(`/passport/apikey`, {limit: 1});

      expect(keys).toEqual({
        meta: {total: 2},
        data: [firstKey]
      });
    });
  });

  describe("findOne", () => {
    it("should return the apikey", async () => {
      const {body: insertedApiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });
      const {body: apiKey} = await req.get(`/passport/apikey/${insertedApiKey._id}`, undefined);
      expect(apiKey).toEqual(insertedApiKey);
    });

    it("should return 404", async () => {
      const res = await req
        .get(`/passport/apikey/${ObjectId.createFromTime(Date.now())}`, undefined)
        .catch(r => r);
      expect(res.statusCode).toBe(404);
    });
  });

  describe("insertOne", () => {
    it("should add new apikey", async () => {
      const {body: apiKey} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      expect(apiKey._id).not.toBeFalsy();
      expect(apiKey.name).toBe("test");
      expect(apiKey.description).toBe("test");
      expect(apiKey.key).not.toBeFalsy();
      expect(apiKey.active).toBe(true);
    });

    it("should return validation errors", async () => {
      const {body, statusCode} = await req
        .post("/passport/apikey", {
          description: "test"
        })
        .catch(r => r);
      expect(body.error).toBe(" should have required property 'name'");
      expect(statusCode).toBe(400);
    });
  });

  describe("updatOne", () => {
    it("should update the apiKey", async () => {
      const {body} = await req.post("/passport/apikey", {
        name: "test",
        description: "test"
      });

      const {body: updatedBody} = await req.post(`/passport/apikey/${body._id}`, {
        name: "test1",
        description: "test1",
        active: false
      });

      expect(updatedBody._id).not.toBeFalsy();
      expect(updatedBody.name).toBe("test1");
      expect(updatedBody.description).toBe("test1");
      expect(updatedBody.key).not.toBeFalsy();
      expect(updatedBody.active).toBe(false);
    });

    it("should not update and return 404", async () => {
      const res = await req
        .post(`/passport/apikey/${ObjectId.createFromTime(Date.now())}`, {
          name: "test1",
          description: "test1",
          active: false
        })
        .catch(r => r);

      expect(res.statusCode).toBe(404);
    });
  });
});
