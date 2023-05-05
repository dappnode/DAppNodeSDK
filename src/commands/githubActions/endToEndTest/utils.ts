import chalk from "chalk";
import { Manifest } from "../../../types.js";
import {
  Network,
  StakerConfigSet,
  consensusClientsGnosis,
  consensusClientsMainnet,
  consensusClientsPrater,
  executionClientsGnosis,
  executionClientsMainnet,
  executionClientsPrater,
  executionPkgs,
  stakerPkgs
} from "./types.js";
import { DappmanagerTestApi } from "./dappmanagerTestApi.js";
import { getDefaultExecClient, getStakerConfigByNetwork } from "./params.js";
import { cloneDeep } from "lodash-es";

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
  network: Network
): Promise<void> {
  const mutableStakerConfig: StakerConfigSet<Network> = cloneDeep(
    getStakerConfigByNetwork(network)
  );

  const clientTypes = {
    mainnet: {
      execution: executionClientsMainnet,
      consensus: consensusClientsMainnet
    },
    gnosis: {
      execution: executionClientsGnosis,
      consensus: consensusClientsGnosis
    },
    prater: {
      execution: executionClientsPrater,
      consensus: consensusClientsPrater
    }
  };

  if (!(network in clientTypes)) {
    throw Error("unknown network");
  }

  const { execution, consensus } = clientTypes[network];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (execution.includes(dnpName as any))
    mutableStakerConfig.executionClient.dnpName = dnpName as typeof execution[number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  else if (consensus.includes(dnpName as any))
    mutableStakerConfig.consensusClient.dnpName = dnpName as typeof consensus[number];

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
    process.env.TEST ||
    !isStakerPkg ||
    (isExecutionPkg && dnpName !== getDefaultExecClient(network))
  )
    return false;

  return true;
}
