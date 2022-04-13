import { readReleaseFile } from "../../releaseFiles/readReleaseFile";
import { ReleaseFileType } from "../../releaseFiles/types";

export function getCurrentLocalVersion({ dir }: { dir: string }): string {
  // Load manifest
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir });
  const currentVersion = manifest.data.version;

  return currentVersion;
}
