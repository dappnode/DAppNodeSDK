import { readManifest, writeManifest } from "../manifest";
import { updateCompose } from "../compose";
import { check } from "../check";
import { getNextVersionFromApm } from "./getNextVersionFromApm";

export async function increaseFromApmVersion({ type, ethProvider, dir }) {
  // Check variables
  const nextVersion = await getNextVersionFromApm({ type, ethProvider, dir });

  // Load manifest
  const manifest = readManifest(dir);
  check(manifest, "manifest", "object");

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest(dir, manifest);
  const { name, version } = manifest;
  updateCompose({ name, version, dir });

  return nextVersion;
}
