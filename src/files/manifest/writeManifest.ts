import fs from "fs";
import { getManifestPath } from "./getManifestPath";
import { stringifyJson } from "./stringifyJson";
import { Manifest, ManifestFormat, ManifestPaths } from "./types";

/**
 * Writes a manifest. Without arguments defaults to write the manifest at './dappnode_package.json'
 */
export function writeManifest(
  manifest: Manifest,
  format: ManifestFormat,
  paths?: ManifestPaths
): void {
  const manifestPath = getManifestPath(format, paths);
  fs.writeFileSync(manifestPath, stringifyJson(manifest, format));
}
