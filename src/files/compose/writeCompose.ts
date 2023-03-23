import fs from "fs";
import prettier from "prettier";
import yaml from "js-yaml";
import { Compose, ComposePaths } from "./types.js";
import { getComposePath } from "./getComposePath.js";

/**
 * Writes the docker-compose.
 */
export function writeCompose(compose: Compose, paths?: ComposePaths): void {
  const composePath = getComposePath(paths);
  fs.writeFileSync(composePath, stringifyCompose(compose));
}

// Utils

function stringifyCompose(compose: Compose): string {
  return prettier.format(yaml.dump(compose, { indent: 2 }), {
    // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "none",
    // Built-in parser for YAML
    parser: "yaml"
  });
}
