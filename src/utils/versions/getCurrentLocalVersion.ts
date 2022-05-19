import { readManifest } from "../../releaseFiles/manifest/manifest";

export function getCurrentLocalVersion({ dir }: { dir: string }): string {
  // Load manifest
  const { manifest } = readManifest({ dir });
  const currentVersion = manifest.version;

  return currentVersion;
}
