import fs from "fs";
import path from "path";
import { CliError } from "../params";
import { Manifest, ManifestImage, Compose } from "../types";

const manifestFileName = "dappnode_package.json";

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 *
 * @param {Object} kwargs: {
 *   dir: './folder', [optional] directory to load the manifest from
 *   manifestFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 * @return {String} path = './dappnode_package.json'
 */
export function getManifestPath(dir = "./") {
  return path.join(dir, manifestFileName);
}

/**
 * Writes a manifest. Without arguments defaults to write the manifest at './dappnode_package.json'
 *
 * @param {Object} kwargs: {
 *   manifest: <manifest object>
 *   dir: './folder', [optional] directory to load the manifest from
 *   manifestFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 */
export function writeManifest(dir: string, manifest: Manifest) {
  const path = getManifestPath(dir);
  const data = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path, data);
}

/**
 * Reads a manifest raw data. Without arguments defaults to read the manifest at './dappnode_package.json'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 */
export function readManifestString(dir: string): string {
  const path = getManifestPath(dir);

  // Recommended way of checking a file existance https://nodejs.org/api/fs.html#fs_fs_exists_path_callback
  try {
    return fs.readFileSync(path, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      throw new CliError(
        `No manifest found at ${path}. Make sure you are in a directory with an initialized DNP.`
      );
    } else {
      throw e;
    }
  }
}

/**
 * Reads a manifest. Without arguments defaults to read the manifest at './dappnode_package.json'
 *
 * @param dir: './folder', [optional] directory to load the manifest from
 */
export function readManifest(dir: string): Manifest {
  const data = readManifestString(dir);

  // Parse manifest in try catch block to show a comprehensive error message
  let manifest;
  try {
    manifest = JSON.parse(data);
  } catch (e) {
    throw Error(`Error parsing manifest: ${e.message}`);
  }

  // Return manifest object
  return manifest;
}

export function manifestFromCompose(compose: Compose): Manifest {
  const name = Object.keys(compose.services)[0];
  const version = compose.services[name].image.split(":")[1];
  const service = compose.services[name];

  const manifest = {
    name: name,
    version: version,
    description: "",
    avatar: "",
    type: "",
    image: {
      path: "",
      hash: "",
      size: 0
    } as ManifestImage,
    author: "",
    license: ""
  };

  if (service.ports) manifest.image.ports = service.ports;
  if (service.volumes) manifest.image.volumes = service.volumes;
  if (service.restart) manifest.image.restart = service.restart;
  return manifest;
}
