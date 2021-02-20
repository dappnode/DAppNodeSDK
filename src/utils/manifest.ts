import fs from "fs";
import path from "path";
import prettier from "prettier";
import { defaultDir, defaultManifestFileName } from "../params";
import { Manifest, ManifestImage, Compose } from "../types";
import { readFile } from "./file";

export interface ManifestPaths {
  /** './folder', [optional] directory to load the manifest from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the manifest file */
  manifestFileName?: string;
}

/**
 * Reads a manifest. Without arguments defaults to read the manifest at './dappnode_package.json'
 */
export function readManifest(paths?: ManifestPaths): Manifest {
  const manifestPath = getManifestPath(paths);
  const data = readFile(manifestPath);

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

/**
 * Writes a manifest. Without arguments defaults to write the manifest at './dappnode_package.json'
 */
export function writeManifest(manifest: Manifest, paths?: ManifestPaths): void {
  const manifestPath = getManifestPath(paths);
  fs.writeFileSync(manifestPath, stringifyJson(manifest));
}

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 * @return path = './dappnode_package.json'
 */
export function getManifestPath(paths?: ManifestPaths): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.manifestFileName || defaultManifestFileName
  );
}

/**
 * JSON.stringify + run prettier on the result
 */
export function stringifyJson<T>(json: T): string {
  return prettier.format(JSON.stringify(json, null, 2), {
    // DAppNode prettier options, to match DAppNodeSDK + DAPPMANAGER
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "none",
    parser: "json"
  });
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

/**
 * Gets the repo slug from a manifest, using the repository property
 *
 * @returns repoSlug = "dappnode/DNP_ADMIN"
 */
export function getRepoSlugFromManifest(paths: ManifestPaths): string {
  const githubBaseUrl = "https://github.com/";

  const manifest = readManifest(paths);
  const { type, url } = manifest.repository || {};
  // Ignore faulty manifests
  if (type !== "git" || !url || !url.includes(githubBaseUrl)) return "";
  // Get repo slug from the repoUrl, i.e. "https://github.com/dappnode/DNP_VPN"
  const repoSlug = url.split(githubBaseUrl)[1] || "";
  return repoSlug.replace(/\/+$/, "").replace(".git", "");
}
