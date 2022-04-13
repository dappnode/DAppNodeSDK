import { readManifest } from "../../releaseFiles/manifest/manifest";
import {
  readCompose,
  updateComposeImageTags
} from "../../releaseFiles/compose/compose";
import { getNextVersionFromApm } from "./getNextVersionFromApm";
import { AllowedFormats, ReleaseFileType, ReleaseType } from "../../types";
import { writeReleaseFile } from "../../releaseFiles/writeReleaseFile";

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
  const { manifest, manifestFormat: format } = readManifest({ dir });

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeReleaseFile({ type: ReleaseFileType.manifest, data: manifest }, format, {
    dir
  });
  const { name, version } = manifest;
  const compose = readCompose({ dir, composeFileName });
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeReleaseFile(
    { type: ReleaseFileType.compose, data: newCompose },
    AllowedFormats.yml,
    { dir, releaseFileName: composeFileName }
  );

  return nextVersion;
}
