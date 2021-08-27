import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import prettier from "prettier";
import { defaultDir, releaseFiles } from "../params";
import { Manifest, ManifestFormat } from "../types";
import { readFile } from "./file";

export interface ManifestPaths {
  /** './folder', [optional] directory to load the manifest from */
  dir?: string;
  /** 'manifest-admin.json', [optional] name of the manifest file */
  manifestFileName?: string;
}

function parseFormat(filepath: string): ManifestFormat {
  if (/.json$/.test(filepath)) return ManifestFormat.json;
  if (/.yml$/.test(filepath)) return ManifestFormat.yml;
  if (/.yaml$/.test(filepath)) return ManifestFormat.yaml;
  throw Error(`Unsupported manifest format: ${filepath}`);
}

/**
 * Reads a manifest. Without arguments defaults to read the manifest at './dappnode_package.json'
 */
export function readManifest(
  paths?: ManifestPaths
): { manifest: Manifest; format: ManifestFormat } {
  // Figure out the path and format
  const manifestPath = findManifestPath(paths);
  const format = parseFormat(manifestPath);
  const data = readFile(manifestPath);

  // Parse manifest in try catch block to show a comprehensive error message
  try {
    return {
      format,
      manifest: yaml.load(data)
    };
  } catch (e) {
    throw Error(`Error parsing manifest: ${e.message}`);
  }
}

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
  format: ManifestFormat,
  paths?: ManifestPaths
): string {
  return path.join(
    paths?.dir || defaultDir,
    paths?.manifestFileName || `dappnode_package.${format}`
  );
}

/**
 * JSON.stringify + run prettier on the result
 */
export function stringifyJson<T>(json: T, format: ManifestFormat): string {
  switch (format) {
    case ManifestFormat.json:
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

    case ManifestFormat.yml:
    case ManifestFormat.yaml:
      return prettier.format(yaml.dump(json, { indent: 2 }), {
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
