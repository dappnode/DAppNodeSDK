import { readReleaseFile } from "../../releaseFiles/readReleaseFile";
import { ReleaseFileType } from "../../types";

export function getCurrentLocalVersion({ dir }: { dir: string }): string {
  // Load manifest
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir });
  const currentVersion = manifest.releaseFile.version;

  return currentVersion;
}
