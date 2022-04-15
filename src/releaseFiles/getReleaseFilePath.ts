import path from "path";
import { defaultDir } from "../params";
import { AllowedFormats, ReleaseFileType, ReleaseFilePaths } from "./types";

/**
 * Get release file path. Without arguments defaults to './dappnode_package.json' | './docker-compose.yml' | './setup-wizard.yaml'
 * @return path = './dappnode_package.json'
 */
export function getReleaseFilePath(
  format: AllowedFormats,
  releaseFileType: ReleaseFileType,
  paths?: ReleaseFilePaths
): string {
  const dirPath = paths?.dir || defaultDir;
  if (paths?.releaseFileName) return path.join(dirPath, paths.releaseFileName);

  switch (releaseFileType) {
    case ReleaseFileType.manifest:
      return path.join(dirPath, `dappnode_package.${format}`);
    case ReleaseFileType.compose:
      return path.join(dirPath, `docker-compose.${format}`);
    case ReleaseFileType.setupWizard:
      return path.join(dirPath, `setup-wizard.${format}`);
  }
}
