import fs from "fs";
import { getManifestPath } from "./getManifestPath.js";
import { stringifyJson } from "./stringifyJson.js";
import { Manifest } from "@dappnode/types";
import { ManifestFormat, ManifestPaths } from "./types.js";

/**
 * Writes a manifest. Without arguments defaults to write the manifest at './dappnode_package.json'
 * Type Partial<Manifest> is used to allow writing partial manifests for template mode (several variants)
 */
export function writeManifest<T extends Manifest | Partial<Manifest>>(
  manifest: T,
  format: ManifestFormat,
  paths?: ManifestPaths
): void {
  const manifestPath = getManifestPath(format, paths);
  fs.writeFileSync(manifestPath, stringifyJson(manifest, format));
}
