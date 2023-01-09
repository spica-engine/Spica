import {
  Filters,
  findNodeByName,
  getFullName,
  isDirectory,
  mapNodesToObjects,
  mapObjectsToNodes
} from "./helpers";
import {StorageNode, Storage} from "./interfaces/storage";
describe("Helpers", () => {
  let text, root, sub: StorageNode;
  let nodes: StorageNode[] = [];
  let objects: Storage[] = [];

  beforeEach(() => {
    root = {
      _id: "1",
      parent: undefined,
      name: "root",
      isHighlighted: false,
      isDirectory: true,
      children: [],
      content: {
        type: "",
        size: 0
      },
      index: 2,
      url: "obj1"
    };

    sub = {
      _id: "2",
      parent: root,
      name: "sub",
      isHighlighted: false,
      children: [],
      isDirectory: true,
      content: {
        type: "",
        size: 0
      },
      index: 1,
      url: "obj2"
    };

    text = {
      _id: "3",
      parent: sub,
      name: "text.txt",
      children: [],
      isDirectory: false,
      isHighlighted: false,
      content: {
        type: "text/plain",
        size: 1
      },
      index: 0,
      url: "obj3"
    };

    sub.children = [text];
    root.children = [sub];

    nodes = [root];

    objects = [
      {
        _id: "3",
        name: "root/sub/text.txt",
        content: {
          type: "text/plain",
          size: 1
        },
        url: "obj3"
      },
      {
        _id: "2",
        name: "root/sub/",
        content: {
          type: "",
          size: 0
        },
        url: "obj2"
      },
      {
        _id: "1",
        name: "root/",
        content: {
          type: "",
          size: 0
        },
        url: "obj1"
      }
    ];
  });

  describe("Filters", () => {
    const files = [
      "root/",
      "/root/",
      "root/sub/",
      "root/asd.txt",
      "/root/sub/",
      "root/sub/test.png",
      "test.png"
    ];

    it("should list root directories", () => {
      const regexp = new RegExp(Filters.ListRootDirs.name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/"]);
    });

    it("should list only objects, not directories", () => {
      const regexp = new RegExp(Filters.ListOnlyObjects.name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/asd.txt", "root/sub/test.png", "test.png"]);
    });

    it("should subresources on the first depth", () => {
      const regexp = new RegExp(Filters.ListFirstChildren("root/").name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/sub/", "root/asd.txt"]);
    });

    it("should subresources on the first depth with itself", () => {
      const regexp = new RegExp(Filters.ListFirstChildren("root/", true).name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/", "root/sub/", "root/asd.txt"]);
    });

    it("should list anything under the directory", () => {
      const regexp = new RegExp(Filters.ListAllChildren("root/").name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/sub/", "root/asd.txt", "root/sub/test.png"]);
    });

    it("should list anything under the directory with itself", () => {
      const regexp = new RegExp(Filters.ListAllChildren("root/", true).name.$regex);
      const filtereds = files.filter(f => regexp.test(f));
      expect(filtereds).toEqual(["root/", "root/sub/", "root/asd.txt", "root/sub/test.png"]);
    });
  });

  describe("getFullName", () => {
    it("should get fullname of node", () => {
      expect(getFullName(text)).toEqual("root/sub/text.txt");
      expect(getFullName(sub)).toEqual("root/sub/");
      expect(getFullName(root)).toEqual("root/");
    });
  });

  describe("isDirectory", () => {
    it("should return true", () => {
      expect(isDirectory({content: {size: 0, type: ""}} as any)).toEqual(true);
    });

    it("should return false", () => {
      expect(isDirectory({content: {size: 100, type: "text/plain"}} as any)).toEqual(false);
    });
  });

  describe("findNodeByName", () => {
    it("should find node by name", () => {
      const foundNode = findNodeByName("root/sub/text.txt", nodes);
      expect(foundNode).toEqual(text);
    });
  });

  describe("mapNodesToObjects", () => {
    it("should map nodes to the objects", () => {
      const _objects = mapNodesToObjects(nodes);
      expect(_objects).toEqual(objects);
    });
  });

  describe("mapObjectsToNodes", () => {
    it("should map objecst to the nodes", () => {
      const _nodes = mapObjectsToNodes(objects);
      expect(_nodes).toEqual(nodes);
    });

    it("should map objects to nodes even if their parents do not actually exist", () => {
      const objects = [
        {
          _id: "3",
          name: "root/sub/text.txt",
          content: {
            type: "text/plain",
            size: 1
          },
          url: "obj3"
        },
        {
          _id: "4",
          name: "root/sub/subsub/another.png",
          content: {
            type: "image/png",
            size: 2
          },
          url: "obj4"
        }
      ];

      const nodes = mapObjectsToNodes(objects);
      const anotherPng: StorageNode = {
        _id: "4",
        name: "another.png",
        content: {
          type: "image/png",
          size: 2
        },
        url: "obj4",
        children: [],
        parent: undefined,
        isDirectory: false,
        isHighlighted: false,
        index: 1
      };
      const subSub: StorageNode = {
        name: "subsub",
        content: {type: "", size: 0},
        parent: undefined,
        isDirectory: true,
        isHighlighted: false,
        children: [anotherPng]
      };

      const textTxt: StorageNode = {
        _id: "3",
        name: "text.txt",
        content: {
          type: "text/plain",
          size: 1
        },
        url: "obj3",
        children: [],
        parent: undefined,
        isDirectory: false,
        isHighlighted: false,
        index: 0
      };
      const sub: StorageNode = {
        name: "sub",
        content: {type: "", size: 0},
        parent: undefined,
        isDirectory: true,
        isHighlighted: false,
        children: [textTxt, subSub]
      };

      const root: StorageNode = {
        name: "root",
        content: {
          type: "",
          size: 0
        },
        parent: undefined,
        isDirectory: true,
        isHighlighted: false,
        children: [sub]
      };

      sub.parent = root;
      subSub.parent = sub;
      textTxt.parent = sub;
      anotherPng.parent = subSub;

      expect(nodes).toEqual([root]);
    });
  });
});
