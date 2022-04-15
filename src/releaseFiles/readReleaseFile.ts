import fs from "fs";
import yaml from "js-yaml";
import { Compose } from "./compose/types";
import { findReleaseFilePath } from "./findReleaseFilePath";
import { Manifest } from "./manifest/types";
import { SetupWizard } from "./setupWizard.ts/types";
import { ReleaseFileType, ReleaseFilePaths, AllowedFormats } from "./types";

type ComposeOrManifestOrSetupWizard<
  T extends
    | ReleaseFileType.compose
    | ReleaseFileType.manifest
    | ReleaseFileType.setupWizard
> = T extends ReleaseFileType.compose
  ? Compose
  : T extends ReleaseFileType.manifest
  ? Manifest
  : SetupWizard;

/**
 * Reads a release file. Without arguments defaults to read the release file at './dappnode_package.json' | './setup-wizard.yml' | './docker-compose.yml'
 */
export function readReleaseFile<
  T extends
    | ReleaseFileType.compose
    | ReleaseFileType.manifest
    | ReleaseFileType.setupWizard
>(
  releaseFileType: T,
  paths?: ReleaseFilePaths
): {
  releaseFile: ComposeOrManifestOrSetupWizard<T>;
  releaseFileFormat: AllowedFormats;
} {
  // Figure out the path and format
  const releaseFilePath = findReleaseFilePath(releaseFileType, paths);
  if (releaseFileType === ReleaseFileType.setupWizard && !releaseFilePath)
    return {
      releaseFile: {} as ComposeOrManifestOrSetupWizard<T>,
      releaseFileFormat: AllowedFormats.yml
    };
  const releaseFileFormat = parseFormat(releaseFilePath);
  const data = readFile(releaseFilePath);

  // Parse release file in try catch block to show a comprehensive error message
  try {
    return {
      releaseFileFormat,
      releaseFile: yaml.load(data)
    };
  } catch (e) {
    throw Error(`Error parsing ${releaseFileType} : ${e.message}`);
  }
}

// Utils

/**
 * fs.readFileSync with nicer error message
 */
function readFile(filepath: string): string {
  // Recommended way of checking a file existance https://nodejs.org/api/fs.html#fs_fs_exists_path_callback
  try {
    return fs.readFileSync(filepath, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      throw Error(
        `${filepath} not found. Make sure you are in a directory with an initialized DNP.`
      );
    } else {
      throw e;
    }
  }
}

function parseFormat(filepath: string): AllowedFormats {
  if (/.json$/.test(filepath)) return AllowedFormats.json;
  if (/.yml$/.test(filepath)) return AllowedFormats.yml;
  if (/.yaml$/.test(filepath)) return AllowedFormats.yaml;
  throw Error(`Unsupported file format: ${filepath}`);
}
