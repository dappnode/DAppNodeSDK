import semver from "semver";
import { readManifest, writeManifest } from "../manifest";
import { readCompose, writeCompose, updateComposeImageTags } from "../compose";
import { checkSemverType } from "../checkSemverType";
import { ReleaseType } from "../../types";

export async function increaseFromLocalVersion({
  type,
  dir
}: {
  type: ReleaseType;
  dir: string;
}): Promise<string> {
  // Check variables
  checkSemverType(type);

  // Load manifest
  const manifest = readManifest(dir);

  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion) throw Error(`Invalid increase: ${currentVersion} ${type}`);
  manifest.version = nextVersion;

  if (manifest.image) {
    // Only on manifest type release
    // Reset the image path, hash, and size fields.
    // They no longer represent the increased version
    manifest.image.path = "";
    manifest.image.hash = "";
    manifest.image.size = 0;
  }

  // Mofidy and write the manifest and docker-compose
  writeManifest(dir, manifest);
  const { name, version } = manifest;
  const compose = readCompose(dir);
  writeCompose(dir, updateComposeImageTags(compose, { name, version }));

  return nextVersion;
}
