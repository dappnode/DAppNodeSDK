import semver from "semver";

import { checkSemverType } from "../checkSemverType.js";
import { ReleaseType } from "../../types.js";
import {
  readManifest,
  writeManifest,
  readCompose,
  writeCompose,
  updateComposeImageTags
} from "../../files/index.js";
import { Manifest } from "@dappnode/types";

export async function increaseFromLocalVersion({
  type,
  dir,
  compose_file_name
}: {
  type: ReleaseType;
  dir: string;
  compose_file_name: string;
}): Promise<string> {
  const composeFileName = compose_file_name;
  // Check variables
  checkSemverType(type);

  // Load manifest
  const { manifest, format } = readManifest({ paths: { dir } });

  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion) throw Error(`Invalid increase: ${currentVersion} ${type}`);
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest<Manifest>(manifest, format, { dir });
  const { name, version } = manifest;
  const compose = readCompose({ dir, composeFileName });
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
