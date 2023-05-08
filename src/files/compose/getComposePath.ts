import path from "path";
import { defaultDir, defaultComposeFileName } from "../../params.js";
import { ComposePaths } from "@dappnode/types";

/**
 * Get compose path. Without arguments defaults to './docker-compose.yml'
 * @return path = './dappnode_package.json'
 */
export function getComposePath(paths?: ComposePaths): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.composeFileName || defaultComposeFileName
  );
}
