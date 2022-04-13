import semver from "semver";
import { updateComposeImageTags } from "../compose";
import { checkSemverType } from "../checkSemverType";
import { ReleaseType } from "../../types";
import { writeReleaseFile } from "../../releaseFiles/writeReleaseFile";
import { readReleaseFile } from "../../releaseFiles/readReleaseFile";
import { ReleaseFileType, AllowedFormats } from "../../releaseFiles/types";

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
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir });

  const currentVersion = manifest.data.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion) throw Error(`Invalid increase: ${currentVersion} ${type}`);
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
