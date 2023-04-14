import chalk from "chalk";
import { shell } from "../../../utils/shell.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import {
  nonStakerPackagesSetup,
  packagesToKeep,
  stakerGnosisConfig,
  stakerMainnetConfig,
  stakerPraterConfig
} from "./params.js";
import { IpfsClientTarget } from "./types.js";

/**
 * Ensure that the DAppNode environment is ready to run the integration tests
 */
export async function ensureDappnodeEnvironment({
  dappmanagerTestApi
}: {
  dappmanagerTestApi: DappmanagerTestApi;
}): Promise<void> {
  console.log(chalk.blue("\nEnsuring DAppNode environment...\n"));

  console.log(
    "Make sure that the /etc/resolv.conf file has the Bind container IP address so container aliases can be resolved from the host"
  );
  await setBindContainerIp();
  // Check dappmanager is running
  console.log("Check dappmanager test API is running");
  await dappmanagerTestApi.healthCheck();
  // Make sure extra pkgs are removed
  console.log("Make sure extra pkgs are removed");
  await ensureOnlyDefaultSetupPkgsAreInstalled(dappmanagerTestApi);
  // Ensure that the Staker configurations are persisted
  console.log("Ensure that the Staker configurations are persisted");
  await persistStakerConfigs(dappmanagerTestApi);
  console.log("Ensure the non Staker packages needed are also installed");
  await ensureNonStakerPkgsAreInstalled(dappmanagerTestApi);
  console.log("Ensure IPFS repository is in local mode");
  await ensureIpfsInLocalMode(dappmanagerTestApi);
}

/**
 * Checks the /etc/resolv.conf file has the Bind container IP address so container aliases can be resolved from the host
 */
async function setBindContainerIp(): Promise<void> {
  const bindContainerIp = "172.33.1.2";
  const resolvConfPath = "/etc/resolv.conf";

  const isBindContainerIpSet = await shell(
    `grep -q ${bindContainerIp} ${resolvConfPath}`
  );
  if (!isBindContainerIpSet)
    await shell(
      `echo "nameserver ${bindContainerIp}" | sudo tee -a ${resolvConfPath}`
    );
}

/**
 * Ensure that the Staker configurations are persisted
 */
async function persistStakerConfigs(
  dappmanagerTestApi: DappmanagerTestApi
): Promise<void> {
  await dappmanagerTestApi.stakerConfigSet(stakerMainnetConfig);
  await dappmanagerTestApi.stakerConfigSet(stakerGnosisConfig);
  await dappmanagerTestApi.stakerConfigSet(stakerPraterConfig);
}

/**
 * Ensure only required packages are installed (Staker configs from prater mainnet and gnosis)
 */
async function ensureOnlyDefaultSetupPkgsAreInstalled(
  dappmanagerTestApi: DappmanagerTestApi
): Promise<void> {
  const installedPackages = await dappmanagerTestApi.packagesGet();

  for (const installedPackage of installedPackages) {
    if (!packagesToKeep.includes(installedPackage.dnpName)) {
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
    if (!installedPackages.some(({ dnpName }) => dnpName === pkg.dnpName)) {
      await dappmanagerTestApi.packageInstall(pkg);
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
    console.log("IPFS is not in local mode. Switching to local mode...");
    ipfsMode.ipfsClientTarget = IpfsClientTarget.local;

    await dappmanagerTestApi.ipfsClientTargetSet({
      ipfsRepository: ipfsMode,
      deleteLocalIpfsClient: false
    });
  }
}
