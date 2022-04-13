import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { defaultDir, releaseFiles } from "../../params";
import { Manifest, AllowedFormats } from "../../types";
import { readFile } from "../../utils/file";
import { parseFormat } from "../../utils/parseFormat";

interface ManifestPaths {
  /** './folder', [optional] directory to load the manifest from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the manifest file */
  manifestFileName?: string;
}

/**
 * Reads a manifest. Without arguments defaults to read the manifest at './dappnode_package.json'
 */
export function readManifest(
  paths?: ManifestPaths
): { manifest: Manifest; manifestFormat: AllowedFormats } {
  // Figure out the path and format
  const manifestPath = findManifestPath(paths);
  const manifestFormat = parseFormat(manifestPath);
  const data = readFile(manifestPath);

  // Parse manifest in try catch block to show a comprehensive error message
  try {
    return {
      manifestFormat,
      manifest: yaml.load(data)
    };
  } catch (e) {
    throw Error(`Error parsing manifest: ${e.message}`);
  }
}

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 * @return path = './dappnode_package.json'
 */
export function findManifestPath(paths?: ManifestPaths): string {
  const dirPath = paths?.dir || defaultDir;
  if (paths?.manifestFileName) {
    return path.join(dirPath, paths?.manifestFileName);
  } else {
    const files = fs.readdirSync(dirPath);
    const filepath = files.find(file => releaseFiles.manifest.regex.test(file));
    if (!filepath)
      throw Error(
        `No manifest found in directory ${dirPath}. Make sure you are in a directory with an initialized DNP.`
      );
    return path.join(dirPath, filepath);
  }
}

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 * @return path = './dappnode_package.json'
 */
export function getManifestPath(
  format: AllowedFormats,
  paths?: ManifestPaths
): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.manifestFileName || `dappnode_package.${format}`
  );
}

/**
 * Gets the repo slug from a manifest, using the repository property
 *
 * @returns repoSlug = "dappnode/DNP_ADMIN"
 */
export function getRepoSlugFromManifest(paths: ManifestPaths): string {
  const githubBaseUrl = "https://github.com/";

  const { manifest } = readManifest(paths);
  const { type, url } = manifest.repository || {};
  // Ignore faulty manifests
  if (type !== "git" || !url || !url.includes(githubBaseUrl)) return "";
  // Get repo slug from the repoUrl, i.e. "https://github.com/dappnode/DNP_VPN"
  const repoSlug = url.split(githubBaseUrl)[1] || "";
  return repoSlug.replace(/\/+$/, "").replace(".git", "");
}
