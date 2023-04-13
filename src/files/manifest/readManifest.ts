import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { readFile } from "../../utils/file.js";
import { ManifestPaths, Manifest, ManifestFormat } from "./types.js";
import { defaultDir, releaseFiles } from "../../params.js";

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
