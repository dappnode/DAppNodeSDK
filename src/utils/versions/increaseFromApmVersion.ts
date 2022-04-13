import { updateComposeImageTags } from "../compose";
import { getNextVersionFromApm } from "./getNextVersionFromApm";
import { AllowedFormats, ReleaseFileType, ReleaseType } from "../../types";
import { writeReleaseFile } from "../../releaseFiles/writeReleaseFile";
import { readReleaseFile } from "../../releaseFiles/readReleaseFile";

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
  manifest.releaseFile.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeReleaseFile(
    { type: ReleaseFileType.manifest, data: manifest.releaseFile },
    manifest.releaseFileFormat,
    {
      dir
    }
  );
  const { name, version } = manifest.releaseFile;
  const compose = readReleaseFile(ReleaseFileType.compose, {
    dir,
    releaseFileName: composeFileName
  });
  const newCompose = updateComposeImageTags(compose.releaseFile, {
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
