import chalk from "chalk";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import {
  nonStakerPackagesSetup,
  getStakerConfigByNetwork,
  packagesToKeep
} from "./params.js";
import { IpfsClientTarget, Network } from "./types.js";
import got from "got";

/**
 * Ensure that the DAppNode environment is ready to run the integration tests
 */
export async function ensureDappnodeEnvironment({
  dappmanagerTestApi,
  network
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  network?: Network;
}): Promise<void> {
  // Check the Bind container IP address is in the /etc/resolv.conf file
  await ensureDockerAliasesResolveFromHost();
  // Check dappmanager is running
  await dappmanagerTestApi.healthCheck();
  // Make sure extra pkgs are removed
  await ensureOnlyDefaultPkgsInstalled(dappmanagerTestApi, network);
  // Ensure that the Staker configurations are persisted
  if (network) await persistStakerConfigs(dappmanagerTestApi, network);
  // Ensure that the Staker packages are installed
  await ensureNonStakerPkgsAreInstalled(dappmanagerTestApi);
  // Ensure IPFS is running and IPFS repository is in local mode
  await ensureIpfsInLocalMode(dappmanagerTestApi);
}

/**
 * Checks dappmanager alias request resolves from host to an HTTP 200
 */
async function ensureDockerAliasesResolveFromHost(): Promise<void> {
  const dappmanagerAlias = "dappmanager.dappnode";
  try {
    const response = await got(`http://${dappmanagerAlias}`);
    if (response.statusCode < 200 || response.statusCode >= 300)
      throw Error(`Response status code is ${response.statusCode}`);
  } catch (e) {
    throw Error(`Could not resolve ${dappmanagerAlias} from host: ${e}`);
  }
}

/**
 * Ensure that the Staker configurations are persisted
 */
async function persistStakerConfigs(
  dappmanagerTestApi: DappmanagerTestApi,
  network: Network
): Promise<void> {
  console.log(`  - Persisting ${network} staker configuration`);
  const stakerConfig = getStakerConfigByNetwork(network);
  await dappmanagerTestApi.stakerConfigSet(stakerConfig);
}

/**
 * Ensure only required packages are installed (Staker configs from prater mainnet and gnosis)
 */
async function ensureOnlyDefaultPkgsInstalled(
  dappmanagerTestApi: DappmanagerTestApi,
  network?: Network
): Promise<void> {
  const installedPackages = await dappmanagerTestApi.packagesGet();

  for (const installedPackage of installedPackages) {
    if (!packagesToKeep(network).includes(installedPackage.dnpName)) {
      console.log(
        chalk.dim(
          `  - Removing package ${installedPackage.dnpName} from the DAppNode environment`
        )
      );
      await dappmanagerTestApi.packageRemove({
        dnpName: installedPackage.dnpName,
        deleteVolumes: true
      });
    }
  }
}

/**
 * Ensure the non Staker packages needed are also installed (install them if not)
 */
async function ensureNonStakerPkgsAreInstalled(
  dappmanagerTestApi: DappmanagerTestApi
): Promise<void> {
  const installedPackages = await dappmanagerTestApi.packagesGet();

  for (const pkg of nonStakerPackagesSetup)
    if (!installedPackages.some(({ dnpName }) => dnpName === pkg)) {
      console.log(
        chalk.dim(`  - Installing package ${pkg} in the DAppNode environment`)
      );
      await dappmanagerTestApi.packageInstall({
        dnpName: pkg,
        version: "latest"
      });
    }
}

/**
 * Ensure IPFS is running and IPFS repository is in local mode
 */
async function ensureIpfsInLocalMode(
  dappmanagerTestApi: DappmanagerTestApi
): Promise<void> {
  const ipfsMode = await dappmanagerTestApi.ipfsClientTargetGet();

  if (ipfsMode.ipfsClientTarget !== "local") {
    console.log(
      chalk.dim("  - IPFS is not in local mode. Switching to local mode...")
    );
    ipfsMode.ipfsClientTarget = IpfsClientTarget.local;

    await dappmanagerTestApi.ipfsClientTargetSet({
      ipfsRepository: ipfsMode,
      deleteLocalIpfsClient: false
    });
  }
}
