import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { readFile } from "../../utils/file.js";
import { defaultDir } from "../../params.js";
import { Manifest, releaseFiles } from "@dappnode/types";
import { ManifestFormat, ManifestPaths } from "./types.js";
import { merge } from "lodash-es";

/**
 * Reads a manifest and optionally merges it with a variant manifest.
 */
export function readManifest(
  paths?: ManifestPaths[],
): { manifest: Manifest; format: ManifestFormat } {
  try {

    if (!paths)
      return loadManifest(); // Load default manifest

    const manifestsSpecs = paths.map((path) => loadManifest(path));

    // TODO: Deprecate any manifest format other than JSON 
    if (manifestsSpecs.some((manifest) => manifest.format !== ManifestFormat.json)) {
      throw new Error("Only JSON format is supported for template mode when merging manifests");
    }

    // Merge all manifests using lodash merge
    const mergedManifest = merge({}, ...manifestsSpecs.map((manifest) => manifest.manifest));

    return {
      format: ManifestFormat.json,
      manifest: mergedManifest,
    };
  } catch (e) {
    throw new Error(`Error parsing manifest: ${e.message}`);
  }
}

/**
 * Loads a manifest from the specified path.
 */
function loadManifest(paths?: ManifestPaths): { manifest: Manifest; format: ManifestFormat } {
  const manifestPath = findManifestPath(paths);
  const format = parseFormat(manifestPath);
  const data = readFile(manifestPath);
  let parsedData;

  try {
    parsedData = yaml.load(data);
  } catch (e) {
    throw new Error(`Error parsing manifest at ${manifestPath}: ${e.message}`);
  }

  if (!parsedData) {
    throw new Error(`Manifest at ${manifestPath} is empty or invalid.`);
  }

  return {
    format,
    manifest: parsedData,
  };
}

// Utils

/**
 * Get manifest path. Without arguments defaults to './dappnode_package.json'
 * @return path = './dappnode_package.json'
 */
function findManifestPath(paths?: ManifestPaths): string {
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

function parseFormat(filepath: string): ManifestFormat {
  if (/.json$/.test(filepath)) return ManifestFormat.json;
  if (/.yml$/.test(filepath)) return ManifestFormat.yml;
  if (/.yaml$/.test(filepath)) return ManifestFormat.yaml;
  throw Error(`Unsupported manifest format: ${filepath}`);
}