import { updateComposeImageTags } from "../compose";
import { getNextVersionFromApm } from "./getNextVersionFromApm";
import { ReleaseType } from "../../types";
import { writeReleaseFile } from "../../releaseFiles/writeReleaseFile";
import { readReleaseFile } from "../../releaseFiles/readReleaseFile";
import { ReleaseFileType, AllowedFormats } from "../../releaseFiles/types";

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
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir });

  // Increase the version
  manifest.data.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeReleaseFile(
    { type: ReleaseFileType.manifest, data: manifest.data },
    manifest.format,
    {
      dir
    }
  );
  const { name, version } = manifest.data;
  const compose = readReleaseFile(ReleaseFileType.compose, {
    dir,
    releaseFileName: composeFileName
  });
  const newCompose = updateComposeImageTags(compose.data, {
    name,
    version
  });
  writeReleaseFile(
    { type: ReleaseFileType.compose, data: newCompose },
    AllowedFormats.yml,
    { dir, releaseFileName: composeFileName }
  );

  return nextVersion;
}
