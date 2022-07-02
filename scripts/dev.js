// minimist 解析命令行参数
const args = require("minimist")(process.argv.slice(2));
const { resolve } = require("path");
const { build } = require("esbuild");

const target = args._[0];

const format = args.f;
const formatMap = {
  global: "iife",
  cjs: "cjs",
  "esm-bundler": "esm",
};

const pkg = require(resolve(__dirname, `../packages/${target}/package.json`));

build({
  entryPoints: [resolve(__dirname, `../packages/${target}/src/index.ts`)],
  outfile: resolve(
    __dirname,
    `../packages/${target}/dist/${target}.${format}.js`
  ),
  bundle: true,
  sourcemap: true,
  format: formatMap[format],
  globalName: pkg.buildOptions.name,
  platform: format === "cjs" ? "node" : "browser",
  watch: {
    onRebuild(error) {
      if (!error) console.log("~~~rebuild~~~");
    },
  },
}).then(() => {
  console.log("~~~watching~~~");
});
