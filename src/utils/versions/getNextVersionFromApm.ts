import semver from "semver";
import { getEthereumUrl } from "../getEthereumUrl.js";
import { checkSemverType } from "../checkSemverType.js";
import { ReleaseType } from "../../types.js";
import { ApmRepository } from "@dappnode/toolkit";

export async function getNextVersionFromApm({
  type,
  ethProvider,
  ensName
}: {
  type: ReleaseType;
  ethProvider: string;
  ensName: string;
}): Promise<string> {
  // Check variables
  checkSemverType(type);

  // Init APM instance
  const apm = new ApmRepository(getEthereumUrl(ethProvider));

  // Fetch the latest version from APM
  console.log(`Fetching next version for ${ensName}`);
  const { version: currentVersion } = await apm.getVersionAndIpfsHash({
    dnpNameOrHash: ensName
  });

  // Increase the version and log it
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  return nextVersion;
}
