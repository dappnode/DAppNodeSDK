import {
  readCompose,
  writeCompose,
  updateComposeImageTags
} from "../../files/compose/index.js";
import { getNextVersionFromApm } from "./getNextVersionFromApm.js";
import { ReleaseType } from "../../types.js";
import { readManifest, writeManifest } from "../../files/index.js";

export async function increaseFromApmVersion({
  type,
  ethProvider,
  dir,
  composeFileName
}: {
  type: ReleaseType;
  ethProvider: string;
  dir: string;
  composeFileName: string;
}): Promise<string> {
  // Check variables
  const nextVersion = await getNextVersionFromApm({ type, ethProvider, dir });

  // Load manifest
  const { manifest, format } = readManifest([{ dir }]);

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest(manifest, format, { dir });
  const { name, version } = manifest;
  const compose = readCompose([{ dir, composeFileName }]);
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
