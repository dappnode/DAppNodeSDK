import path from "path";
import { fileURLToPath } from "url";

const currentModulePath = fileURLToPath(import.meta.url);

export default {
  entry: "./src/index.ts",
  mode: "production",
  target: "node",
  output: {
    path: path.resolve(path.dirname(currentModulePath), "dist"),
    filename: "dappnodesdk.js",
    library: {
      type: "module"
    },
    chunkFormat: "module"
  },
  resolve: {
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
        loader: "node-loader"
      }
    ]
  }
};
