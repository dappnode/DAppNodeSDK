import fs from "fs";
import prettier from "prettier";
import yaml from "js-yaml";
import { getComposePath } from "./getComposePath.js";
import { Compose, ComposeNetworks, ComposePaths, ComposeService, ComposeVolumes } from "@dappnode/types";

type OptionalComposeServiceProperties = Partial<Pick<ComposeService, 'image' | 'build'>>;
type ComposeServiceFlexible = Omit<ComposeService, 'image' | 'build'> & OptionalComposeServiceProperties;

export interface FlexibleCompose {
  version: string;
  services: {
    [dnpName: string]: ComposeServiceFlexible;
  };
  networks?: ComposeNetworks;
  volumes?: ComposeVolumes;
}

/**
 * Writes the docker-compose.
 */
export function writeCompose<T extends Compose | FlexibleCompose>(compose: T, paths?: ComposePaths): void {
  const composePath = getComposePath(paths);
  fs.writeFileSync(composePath, stringifyCompose(compose));
}

// Utils

function stringifyCompose(compose: Compose | FlexibleCompose): string {
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
