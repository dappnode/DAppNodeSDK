import path from "path";
import { defaultDir } from "../../params.js";
import { ManifestFormat, ManifestPaths } from "@dappnode/types";

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 * @return path = './dappnode_package.json'
 */
export function getManifestPath(
  format: ManifestFormat,
  paths?: ManifestPaths
): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.manifestFileName || `dappnode_package.${format}`
  );
}
