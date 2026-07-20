const fs = require("node:fs");
const path = require("node:path");

const second = path.join(__dirname, "src", "second.js");

function isSecondRound() {
  return fs.readFileSync(second, "utf8").includes("SECOND-1");
}

module.exports = (env = {}) => ({
  context: __dirname,
  mode: "development",
  target: "web",
  entry: {
    first: "./src/first.js",
    second: "./src/second.js"
  },
  output: {
    path: env.outputPath || path.join(__dirname, "dist"),
    publicPath: "",
    filename: pathData => {
      if (pathData.chunk?.name !== "first") {
        return "[name].js";
      }
      return isSecondRound() ? "deep/nested/first.js" : "first.js";
    },
    clean: true
  },
  cache: { type: "memory" },
  devtool: false,
  module: {
    parser: {
      javascript: {
        url: "new-url-relative",
        importMeta: false
      }
    }
  },
  optimization: {
    runtimeChunk: "single",
    concatenateModules: false,
    inlineExports: false,
    splitChunks: false
  },
  incremental: true
});
