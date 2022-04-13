import semver from "semver";
import { Apm } from "../Apm";
import { checkSemverType } from "../checkSemverType";
import { ReleaseFileType, ReleaseType } from "../../types";
import { readReleaseFile } from "../../releaseFiles/readReleaseFile";

export async function getNextVersionFromApm({
  type,
  ethProvider,
  dir
}: {
  type: ReleaseType;
  ethProvider: string;
  dir: string;
}): Promise<string> {
  // Check variables
  checkSemverType(type);

  // Init APM instance
  const apm = new Apm(ethProvider);

  // Load manifest
  const manifest = readReleaseFile(ReleaseFileType.manifest, { dir });
  const ensName = manifest.releaseFile.name.toLowerCase();

  // Fetch the latest version from APM
  const currentVersion = await apm.getLatestVersion(ensName);

  // Increase the version and log it
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  return nextVersion;
}
