import semver from "semver";
<<<<<<< HEAD
import { getEthereumUrl } from "../getEthereumUrl.js";
=======
>>>>>>> integrate toolkit v1
import { checkSemverType } from "../checkSemverType.js";
import { ReleaseType } from "../../types.js";
import { readManifest } from "../../files/index.js";
import { ApmRepository } from "@dappnode/toolkit";
<<<<<<< HEAD

=======
import { ethers } from "ethers";
import { getEthereumProviderUrl } from "../Apm.js";
>>>>>>> integrate toolkit v1
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

  // ethProvider is a simple "dappnode" or "infura" string
  // we need to convert it to a valid url
  const parsedProvider = new ethers.JsonRpcProvider(getEthereumProviderUrl(ethProvider))

  // Init APM instance
<<<<<<< HEAD
  const apm = new ApmRepository(getEthereumUrl(ethProvider));
=======
  const apm = new ApmRepository(parsedProvider);
>>>>>>> integrate toolkit v1

  // Load manifest
  const { manifest } = readManifest({ dir });
  const ensName = manifest.name.toLowerCase();

  // Fetch the latest version from APM
<<<<<<< HEAD
  console.log("ensName: ", ensName);
  const { version: currentVersion } = await apm.getVersionAndIpfsHash({
    dnpName: ensName
  });

=======
  const currentVersion = (await apm.getVersionAndIpfsHash({ dnpName: ensName })).version;
  console.log(`Current version2: ${currentVersion}`)
>>>>>>> integrate toolkit v1
  // Increase the version and log it
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  return nextVersion;
}
