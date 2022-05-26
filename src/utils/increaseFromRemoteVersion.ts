import semver from "semver";
import { readManifest, writeManifest } from "./manifest";
import { readCompose, writeCompose, updateComposeImageTags } from "./compose";
import { ReleaseType } from "../types";
import { IPM } from "../providers/pm";

export async function increaseFromRemoteVersion({
  type,
  pm,
  dir,
  composeFileName
}: {
  type: ReleaseType;
  pm: IPM;
  dir: string;
  composeFileName: string;
}): Promise<string> {
  // Load manifest
  const { manifest, format } = readManifest({ dir });

  const curretVersion = await pm.getLatestVersion(manifest.name);

  const nextVersion = semver.inc(curretVersion, type);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest(manifest, format, { dir });
  const { name, version } = manifest;
  const compose = readCompose({ dir, composeFileName });
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
