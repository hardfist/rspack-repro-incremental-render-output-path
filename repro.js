const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { rspack } = require("@rspack/core");

const root = __dirname;
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const freshDist = path.join(root, "dist-fresh");
const second = path.join(src, "second.js");
const state = { round: 0 };
fs.mkdirSync(src, { recursive: true });
fs.writeFileSync(path.join(src, "first.js"), "globalThis.load = () => import('./lazy.js'); console.log(new URL('./asset.txt', import.meta.url));\n");
fs.writeFileSync(path.join(src, "asset.txt"), "ASSET\n");
fs.writeFileSync(path.join(src, "lazy.js"), "export default 'LAZY';\n");
fs.writeFileSync(second, "console.log('SECOND-0');\n");

const makeConfig = outputPath => ({
  context: root,
  mode: "development",
  target: "web",
  entry: { first: "./src/first.js", second: "./src/second.js" },
  output: {
    path: outputPath,
    publicPath: "",
    filename: pathData => pathData.chunk?.name === "first"
      ? state.round === 0 ? "first.js" : "deep/nested/first.js"
      : "[name].js",
    clean: true
  },
  cache: { type: "memory" },
  devtool: false,
  module: { parser: { javascript: { url: "new-url-relative", importMeta: false } } },
  optimization: { runtimeChunk: "single", concatenateModules: false, inlineExports: false, splitChunks: false },
  incremental: true
});

function run(compiler) {
  return new Promise((resolve, reject) => compiler.run((error, stats) => {
    if (error) return reject(error);
    const json = stats.toJson({ all: false, errors: true });
    if (json.errors.length) return reject(new Error(JSON.stringify(json.errors, null, 2)));
    resolve();
  }));
}

function close(compiler) {
  return new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
}

(async () => {
  const compiler = rspack(makeConfig(dist));
  await run(compiler);
  const initial = fs.readFileSync(path.join(dist, "first.js"), "utf8");
  state.round = 1;
  fs.writeFileSync(second, "console.log('SECOND-1');\n");
  compiler.inputFileSystem?.purge?.(second);
  compiler.modifiedFiles = new Set([second]);
  compiler.removedFiles = new Set();
  await run(compiler);
  const hot = fs.readFileSync(path.join(dist, "deep/nested/first.js"), "utf8");
  await close(compiler);

  const freshCompiler = rspack(makeConfig(freshDist));
  await run(freshCompiler);
  const fresh = fs.readFileSync(path.join(freshDist, "deep/nested/first.js"), "utf8");
  await close(freshCompiler);

  const extractAssetUrl = source => source.match(/new URL\("([^"]+\.txt)"/)?.[1];
  console.log({ initial: extractAssetUrl(initial), hot: extractAssetUrl(hot), fresh: extractAssetUrl(fresh) });
  assert.notEqual(initial, fresh, "the fixture must make source rendering depend on output path");
  assert.equal(hot, fresh, "the hot compilation reused source rendered for the old output path");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

