const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/migrate")
};

export default {
  projects: [
    {
      ...commonConfig,
      modulePathIgnorePatterns: ["<rootDir>/test/acceptance/**/*.spec.ts"],
      testMatch: ["<rootDir>/test/**/*.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/acceptance/*.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
