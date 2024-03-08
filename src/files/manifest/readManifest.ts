import yaml from "js-yaml";
import fs from "fs";
import path from "path";
import { readFile } from "../../utils/file.js";
import { defaultDir } from "../../params.js";
import { Manifest, releaseFiles } from "@dappnode/types";
import { ManifestFormat, ManifestPaths } from "./types.js";

/**
 * Reads a manifest. Without arguments defaults to read the manifest at './dappnode_package.json'
 */
export function readManifest(
  paths?: ManifestPaths,
  variantPaths?: ManifestPaths
): { manifest: Manifest; format: ManifestFormat } {
  // Figure out the path and format
  const manifestPath = findManifestPath(paths);
  const format = parseFormat(manifestPath);
  const data = readFile(manifestPath);

  if (!variantPaths) {
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

  const variantManifestPath = findManifestPath(variantPaths);
  const variantFormat = parseFormat(variantManifestPath);
  const variantData = readFile(variantManifestPath);

  if (format !== ManifestFormat.json || variantFormat !== ManifestFormat.json)
    //TODO: Support other formats
    throw Error(`Only JSON format is supported for template mode`);

  try {
    return {
      format,
      manifest: yaml.load({ ...JSON.parse(data), ...JSON.parse(variantData) })
    };
  } catch (e) {
    throw Error(`Error parsing template manifest: ${e.message}`);

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
