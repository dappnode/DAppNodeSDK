import path from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";

const currentModulePath = fileURLToPath(import.meta.url);

export default {
  entry: "./src/dappnodesdk.ts",
  mode: "production",
  target: "node",
  node: {
    // add commonjs globals
    __filename: true,
    __dirname: true
  },
  plugins: [
    new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true }) // this adds the removed shebang
  ],
  output: {
    path: path.resolve(path.dirname(currentModulePath), "dist"),
    filename: "dappnodesdk.js",
    library: {
      type: "module"
    },
    chunkFormat: "module",
    globalObject: "this"
  },
  resolve: {
    alias: {
      "any-observable": "rxjs" // Error: Cannot find any-observable implementation nor global.Observable. You must install polyfill or call require("any-observable/register") with your preferred implementation,
    },
    extensions: [".ts", ".tsx", ".js"],
    extensionAlias: {
      ".js": [".ts", ".js"],
      ".cjs": [".cts", ".cjs"],
      ".mjs": [".mts", ".mjs"]
    }
  },
  experiments: {
    outputModule: true // Enable the output module experiment
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: "tsconfig.json",
            allowTsInNodeModules: true
          }
        }
        // exclude: /node_modules/
      },
      {
        test: /\.node$/, // add a rule for ".node" files
        include: [
          path.resolve(currentModulePath, "node_modules/ipfs-utils/src")
        ],
        loader: "node-loader"
      }
    ]
  }
};
