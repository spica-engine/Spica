import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceModule} from "@spica-server/preference";

describe("PreferenceController", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let db: DatabaseService;

  function addpref(pref: any) {
    return app
      .get(DatabaseService)
      .collection("preferences")
      .insertOne(pref);
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        PassportTestingModule.initialize(),
        PreferenceModule,
        CoreTestingModule
      ],
      providers: []
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    db = module.get(DatabaseService);
    await app.listen(req.socket);
  }, 120000);

  afterEach(async () => await db.collection("preferences").drop());

  afterAll(async () => await app.close());

  it("should get preference", async () => {
    await req.put("/preference/bucket", {scope: "bucket", property: "bucket props"});
    await req.put("/preference/function", {scope: "function", property: "function props"});

    const bucketPref = (await req.get("/preference/bucket", {})).body;
    expect(bucketPref.scope).toBe("bucket");
    expect(bucketPref.property).toBe("bucket props");

    const functionPref = (await req.get("/preference/function", {})).body;
    expect(functionPref.property).toBe("function props");
    expect(functionPref.property).toBe("function props");
  });

  it("should update preference", async () => {
    await addpref({scope: "bucket", property: "bucket props"});

    await req.put("/preference/bucket", {scope: "bucket", property: "new bucket props"});

    const myUpdatedPref = (await req.get("/preference/bucket", {})).body;
    expect(myUpdatedPref.scope).toBe("bucket");
    expect(myUpdatedPref.property).toBe("new bucket props");
  });
});
