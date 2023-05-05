import { Compose } from "../../../files/compose/types.js";
import { Manifest } from "../../../types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import chalk from "chalk";
import {
  getIsStakerPkg,
  printPackageMetadata,
  setStakerConfig,
  getExecuteProofOfAttestation
} from "./utils.js";
import { Network } from "./types.js";
import { executeTestCheckers } from "./testCheckers.js";

/**
 * Execute the tests for the integration test workflow. These tests require
 * a previous setup of the environment.
 * Tests to execute:
 * - Install package from scratch
 * - Update package to the given hash from production
 * For each test, the following checks are performed:
 * - Container status (running, healthy)
 * - No error logs after a timeout
 * - Healthcheck endpoint returns 200
 */
export async function executeEndToEndTests({
  dappmanagerTestApi,
  releaseMultiHash,
  manifest,
  compose,
  errorLogsTimeout,
  healthCheckUrl,
  environmentByService,
  network
}: {
  dappmanagerTestApi: DappmanagerTestApi;
  releaseMultiHash: string;
  manifest: Manifest;
  compose: Compose;
  errorLogsTimeout: number;
  healthCheckUrl?: string;
  environmentByService?: Record<string, string>;
  network?: Network;
}): Promise<void> {
  const errors: Error[] = [];
  const { name } = manifest;
  const isStakerPkg = getIsStakerPkg(name);

  printPackageMetadata(manifest, releaseMultiHash);

  // TEST: Install package from scratch
  console.log(chalk.dim("\nTEST: Install pkg from scratch"));
  await testPackageInstallFromScratch(
    dappmanagerTestApi,
    releaseMultiHash,
    isStakerPkg,
    name,
    compose,
    errorLogsTimeout,
    healthCheckUrl,
    network,
    environmentByService
  ).catch(e => errors.push(e));

  // Skip update test if running in test environment, dappnodesdk package name is not published
  if (process.env.ENVIRONMENT !== "TEST") {
    // Update package to the given hash
    console.log(chalk.dim("\nTEST: Install production pkg and update"));
    await testPackageInstallAndUpdate(
      dappmanagerTestApi,
      releaseMultiHash,
      isStakerPkg,
      name,
      compose,
      errorLogsTimeout,
      healthCheckUrl,
      network,
      environmentByService
    ).catch(e => errors.push(e));
  }

  // Throw aggregated error if any
  if (errors.length > 0) throw Error(errors.map(e => e.message).join("\n"));
}

async function testPackageInstallAndUpdate(
  dappmanagerTestApi: DappmanagerTestApi,
  releaseMultiHash: string,
  isStakerPkg: boolean,
  dnpName: string,
  compose: Compose,
  errorLogsTimeout: number,
  healthCheckUrl?: string,
  network?: Network,
  environmentByService?: Record<string, string>
): Promise<void> {
  // Remove package, if not found it will throw an error but it's ok
  await dappmanagerTestApi
    .packageRemove({ dnpName })
    .catch(() => console.log("  - Package already removed"));
  await dappmanagerTestApi.packageInstall({
    dnpName,
    version: "latest", // Install production version
    userSettings: { environment: environmentByService }
  });
  await dappmanagerTestApi.packageInstall({
    dnpName,
    version: releaseMultiHash, // Install test version
    userSettings: { environment: environmentByService }
  });
  // Set staker config if staker package
  if (isStakerPkg && network)
    await setStakerConfig(dnpName, dappmanagerTestApi, network);
  await executeTestCheckers({
    dnpName,
    compose,
    errorLogsTimeout,
    healthCheckUrl,
    network,
    // We may execute proof of attestation if test is testPackageInstallAndUpdate
    executeProofOfAttestation: getExecuteProofOfAttestation({
      network,
      dnpName,
      isStakerPkg
    })
  });
}

async function testPackageInstallFromScratch(
  dappmanagerTestApi: DappmanagerTestApi,
  releaseMultiHash: string,
  isStakerPkg: boolean,
  dnpName: string,
  compose: Compose,
  errorLogsTimeout: number,
  healthCheckUrl?: string,
  network?: Network,
  environmentByService?: Record<string, string>
): Promise<void> {
  // Remove package, if not found it will throw an error but it's ok
  await dappmanagerTestApi
    .packageRemove({ dnpName })
    .catch(() => console.log("  - Package already removed"));
  await dappmanagerTestApi.packageInstall({
    dnpName,
    version: releaseMultiHash,
    userSettings: { environment: environmentByService || {} }
  });
  // Set staker config if staker package
  if (isStakerPkg && network)
    await setStakerConfig(dnpName, dappmanagerTestApi, network);
  await executeTestCheckers({
    dnpName,
    compose,
    errorLogsTimeout,
    healthCheckUrl,
    network,
    executeProofOfAttestation: false // never execute proof of attestation on install from scratch
  });
}
