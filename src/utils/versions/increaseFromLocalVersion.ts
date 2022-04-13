import semver from "semver";
import { readManifest } from "../../releaseFiles/manifest/manifest";
import {
  readCompose,
  updateComposeImageTags
} from "../../releaseFiles/compose/compose";
import { checkSemverType } from "../checkSemverType";
import { AllowedFormats, ReleaseFileType, ReleaseType } from "../../types";
import { writeReleaseFile } from "../../releaseFiles/writeReleaseFile";

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
  const { manifest, manifestFormat: format } = readManifest({ dir });

  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion) throw Error(`Invalid increase: ${currentVersion} ${type}`);
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
