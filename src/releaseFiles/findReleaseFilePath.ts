import fs from "fs";
import path from "path";
import { defaultDir, releaseFiles } from "../params";
import { ReleaseFileType, ReleaseFilePaths } from "./types";

/**
 * Get release file path. Without arguments defaults to './setup-wizard.yml' | './dappnode_package.json' | './setup-wizard.yml'
 * @return path = './setup-wizard.yml'
 */
export function findReleaseFilePath(
  releaseFileType: ReleaseFileType,
  paths?: ReleaseFilePaths
): string {
  const dirPath = paths?.dir || defaultDir;
  if (paths?.releaseFileName) {
    return path.join(dirPath, paths.releaseFileName);
  } else {
    const files = fs.readdirSync(dirPath);
    const filePath = files.find(file => {
      switch (releaseFileType) {
        case ReleaseFileType.manifest:
          return releaseFiles.manifest.regex.test(file);
        case ReleaseFileType.compose:
          return releaseFiles.compose.regex.test(file);
        case ReleaseFileType.setupWizard:
          return releaseFiles.setupWizard.regex.test(file);
      }
    });
    if (!filePath && releaseFileType === ReleaseFileType.manifest)
      throw Error(`Could not find release file for ${releaseFileType}`);
    if (!filePath && releaseFileType === ReleaseFileType.compose)
      throw Error(`Could not find release file for ${releaseFileType}`);
    if (!filePath) return "";
    return path.join(dirPath, filePath);
  }
}
