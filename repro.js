const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { rspack } = require("@rspack/core");
const createConfig = require("./rspack.config");

const root = __dirname;
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const freshDist = path.join(root, "dist-fresh");
const second = path.join(src, "second.js");
const originalSecond = fs.readFileSync(second, "utf8");
const manual = process.argv.includes("--manual");
fs.writeFileSync(second, "console.log('SECOND-0');\n");

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

function waitForEdit() {
  console.log("Change SECOND-0 to SECOND-1 in src/second.js, then press Enter.");
  return new Promise(resolve => process.stdin.once("data", () => {
    process.stdin.pause();
    resolve();
  }));
}

(async () => {
  let compiler;
  let freshCompiler;
  try {
    compiler = rspack(createConfig({ outputPath: dist }));
    await run(compiler);
    const initial = fs.readFileSync(path.join(dist, "first.js"), "utf8");
    if (manual) {
      await waitForEdit();
    } else {
      fs.writeFileSync(second, "console.log('SECOND-1');\n");
    }
    compiler.inputFileSystem?.purge?.(second);
    compiler.modifiedFiles = new Set([second]);
    compiler.removedFiles = new Set();
    await run(compiler);
    const hot = fs.readFileSync(path.join(dist, "deep/nested/first.js"), "utf8");
    await close(compiler);
    compiler = undefined;

    freshCompiler = rspack(createConfig({ outputPath: freshDist }));
    await run(freshCompiler);
    const fresh = fs.readFileSync(path.join(freshDist, "deep/nested/first.js"), "utf8");

    const extractAssetUrl = source => source.match(/new URL\("([^"]+\.txt)"/)?.[1];
    console.log({ initial: extractAssetUrl(initial), hot: extractAssetUrl(hot), fresh: extractAssetUrl(fresh) });
    assert.notEqual(initial, fresh, "the fixture must make source rendering depend on output path");
    assert.equal(hot, fresh, "the hot compilation reused source rendered for the old output path");
  } finally {
    fs.writeFileSync(second, originalSecond);
    if (compiler) await close(compiler);
    if (freshCompiler) await close(freshCompiler);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
