const {NxAppWebpackPlugin} = require("@nx/webpack/app-plugin");

module.exports = {
  plugins: [
    new NxAppWebpackPlugin({
      target: "node",
      compiler: "tsc",
      tsConfig: "./tsconfig.json",
      optimization: false,
      outputHashing: "none",
      generatePackageJson: true,
      sourceMap: true
    })
  ]
};
