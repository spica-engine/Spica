import {provideLanguageFinalizer} from "@spica-server/bucket/src/locale";

describe("provideLanguageChangeUpdater", () => {
  const translatableBuckets = [
    {_id: "bucket1", properties: {title: {}, description: {}}},
    {_id: "bucket2", properties: {name: {}}}
  ];

  const bucketDataService: any = {
    updateMany: jasmine.createSpy("updateMany").and.returnValue(Promise.resolve()),
    children: () => bucketDataService
  };

  const bucketService: any = {
    aggregate: jasmine.createSpy("aggregate").and.returnValue({
      toArray: () => Promise.resolve(translatableBuckets)
    })
  };

  const updaterFactory = provideLanguageFinalizer(bucketService, bucketDataService);

  it("should return updater function", () => {
    expect(typeof updaterFactory == "function").toBe(true);
  });

  it("should return empty promise when language added", () => {
    updaterFactory(
      {
        language: {
          available: {
            en_US: "English"
          }
        }
      },
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish"
          }
        }
      }
    ).then(result => expect(result).toBeUndefined());
  });

  it("should return update bucket entries when language removed", async () => {
    await updaterFactory(
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish",
            fr: "French",
            de: "Deutschland"
          }
        }
      },
      {
        language: {
          available: {
            en_US: "English",
            tr_TR: "Turkish"
          }
        }
      }
    );

    expect(bucketService.aggregate).toHaveBeenCalledTimes(1);
    expect(bucketService.aggregate).toHaveBeenCalledWith([
      {
        $project: {
          properties: {
            $objectToArray: "$properties"
          }
        }
      },
      {
        $match: {
          "properties.v.options.translate": true
        }
      },
      {
        $project: {
          properties: {
            $filter: {
              input: "$properties",
              as: "property",
              cond: {$eq: ["$$property.v.options.translate", true]}
            }
          }
        }
      },
      {
        $project: {
          properties: {
            $arrayToObject: "$properties"
          }
        }
      }
    ]);

    expect(bucketDataService.updateMany).toHaveBeenCalledTimes(2);
    expect(bucketDataService.updateMany.calls.allArgs()).toEqual([
      [
        "bucket1",
        {},
        {$unset: {"title.fr": "", "title.de": "", "description.fr": "", "description.de": ""}}
      ],
      ["bucket2", {}, {$unset: {"name.fr": "", "name.de": ""}}]
    ]);
  });
});
