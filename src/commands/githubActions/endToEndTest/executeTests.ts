import { Compose } from "../../../files/compose/types.js";
import { Manifest } from "../../../types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import chalk from "chalk";
import { getDefaultExecClient, getStakerConfigByNetwork } from "./params.js";
import { getIsStakerPkg, getIsExecutionClient } from "./utils.js";
import {
  ConsensusClientGnosis,
  ConsensusClientMainnet,
  ConsensusClientPrater,
  ExecutionClientGnosis,
  ExecutionClientMainnet,
  ExecutionClientPrater,
  Network,
  consensusClientsGnosis,
  consensusClientsMainnet,
  consensusClientsPrater,
  executionClientsGnosis,
  executionClientsMainnet,
  executionClientsPrater
} from "./types.js";
import { executeTestCheckers } from "./testCheckers.js";

/**
 * Execute the tests for the integration test workflow. These tests require
 * a previous setup of the environment.
 * Tests to execute:
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
  if (errors.length > 0) {
    const errorMessages = errors.map(e => e.message).join("\n");
    throw Error(errorMessages);
  }
}

function printPackageMetadata(
  manifest: Manifest,
  releaseMultiHash: string
): void {
  console.log(
    chalk.dim(
      `
Package metadata:
  - Package: ${manifest.name}
  - Version: ${manifest.version}
  - Upstream version: ${manifest.upstreamVersion ?? "N/A"}
  - Release: ${releaseMultiHash}
  `
    )
  );
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
    executeProofOfAttestation: getExecuteProofOfAttestation({network, dnpName})
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
    executeProofOfAttestation: false  // never execute proof of attestation on install from scratch
  });
}

async function setStakerConfig(
  dnpName: string,
  dappmanagerTestApi: DappmanagerTestApi,
  network: Network
): Promise<void> {
  const stakerConfig = getStakerConfigByNetwork(network);
  switch (network) {
    case "mainnet":
      if (executionClientsMainnet.includes(dnpName as any))
        stakerConfig.executionClient.dnpName = dnpName as ExecutionClientMainnet;
      else if (consensusClientsMainnet.includes(dnpName as any))
        stakerConfig.consensusClient.dnpName = dnpName as ConsensusClientMainnet;
      break;
    case "gnosis":
      if (executionClientsGnosis.includes(dnpName as any))
        stakerConfig.executionClient.dnpName = dnpName as ExecutionClientGnosis;
      else if (consensusClientsGnosis.includes(dnpName as any))
        stakerConfig.consensusClient.dnpName = dnpName as ConsensusClientGnosis;
      await dappmanagerTestApi.stakerConfigSet(stakerConfig);
      break;
    case "prater":
      if (executionClientsPrater.includes(dnpName as any))
        stakerConfig.executionClient.dnpName = dnpName as ExecutionClientPrater;
      else if (consensusClientsPrater.includes(dnpName as any))
        stakerConfig.consensusClient.dnpName = dnpName as ConsensusClientPrater;
      await dappmanagerTestApi.stakerConfigSet(stakerConfig);
      break;
    default:
      throw Error("unknown network");
  }
  await dappmanagerTestApi.stakerConfigSet(stakerConfig);
}

function getExecuteProofOfAttestation({
  network, 
  dnpName,
  }: {
    network?: Network;
    dnpName: string;
  }): boolean {

  const isStakerPkg = getIsStakerPkg(dnpName);
  const isExecutionPkg = getIsExecutionClient(dnpName);
  
  // Skip proof of attestation if:
  // - network is undefined
  // - running in test environment
  // - im not a staker package
  // - im an execution package but not the one specified in the staker config
  if (!network || process.env.TEST || !isStakerPkg || (isExecutionPkg && dnpName !== getDefaultExecClient(network))) {
    return false
  }
  return true
}