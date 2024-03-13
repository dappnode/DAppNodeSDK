import { readManifest } from "../../files/index.js";

export function getCurrentLocalVersion({ dir }: { dir: string }): string {
  // Load manifest
  const { manifest } = readManifest({ paths: { dir } });
  const currentVersion = manifest.version;

  return currentVersion;
}
