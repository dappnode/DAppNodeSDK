import chalk from "chalk";
import { Network, stakerPkgs } from "@dappnode/types";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import { getDefaultExecClient, getStakerConfigByNetwork } from "./params.js";
import { cloneDeep } from "lodash-es";
import { Manifest } from "@dappnode/types";
import {
  ConsensusPkg,
  ExecutionPkg,
  StakerConfigSet,
  consensusPkgs,
  executionPkgs
} from "./types.js";

export function printPackageMetadata(
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

export function getIsStakerPkg(dnpName: string): boolean {
  if (!dnpName) throw Error("dnpName must be defined");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stakerPkgs.includes(dnpName as any);
}

export async function setStakerConfig(
  dnpName: string,
  dappmanagerTestApi: DappmanagerTestApi,
  network: Network,
  removeConsensusVolumes?: boolean
): Promise<void> {
  const mutableStakerConfig: StakerConfigSet<Network> = cloneDeep(
    getStakerConfigByNetwork(network)
  );

  if (executionPkgs.find(executionClient => executionClient === dnpName))
    mutableStakerConfig.executionClient.dnpName = dnpName as ExecutionPkg;
  else if (consensusPkgs.find(consensusClient => consensusClient === dnpName))
    mutableStakerConfig.consensusClient.dnpName = dnpName as ConsensusPkg;

  if (removeConsensusVolumes)
    await dappmanagerTestApi.packageRestartVolumes({
      dnpName: mutableStakerConfig.consensusClient.dnpName
    });

  await dappmanagerTestApi.stakerConfigSet(mutableStakerConfig);
}

/**
 * Get should executes proof of attestation
 * Skip proof of attestation if:
 *  - network is undefined
 *  - running in test environment
 *  - im not a staker package
 *  - im an execution package but not the one specified in the staker config
 * @param param0
 * @returns
 */
export function getExecuteProofOfAttestation({
  network,
  dnpName,
  isStakerPkg
}: {
  network?: Network;
  dnpName: string;
  isStakerPkg: boolean;
}): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isExecutionPkg = executionPkgs.includes(dnpName as any);
  if (
    !network ||
    network === "mainnet" ||
    process.env.TEST ||
    !isStakerPkg ||
    (isExecutionPkg && dnpName !== getDefaultExecClient(network))
  )
    return false;

  return true;
}
