import Listr from "listr";
import { ethers } from "ethers";
import { getEthereumUrl } from "../../utils/getEthereumUrl.js";
import { getPublishTxLink } from "../../utils/getLinks.js";
import { addReleaseTx } from "../../utils/releaseRecord.js";
import { defaultDir, YargsError } from "../../params.js";
import {
  CliGlobalOptions,
  ListrContextBuildAndPublish,
  TxData
} from "../../types.js";
import { ApmRepository } from "@dappnode/toolkit";
import registryAbi from "../../contracts/ApmRegistryAbi.json";
import { semverToArray } from "../../utils/semverToArray.js";
import repoAbi from "../../contracts/RepoAbi.json";
import { VerbosityOptions } from "../../commands/build/types.js";
import { Manifest } from "@dappnode/types";
import { getRegistryAddressFromDnpName } from "./getRegistryAddressFromEns.js";
import { Repo } from "./types.js";

const isZeroAddress = (address: string): boolean => parseInt(address) === 0;

/**
 * Generates the transaction data necessary to publish the package.
 * It will check if the repository exists first:
 * - If it exists:
 * - If it does not exists:
 *
 * Then it will construct the txData object = {to, value, data, gasLimit} and:
 * - Write it on deploy.txt
 * - Show it on screen
 */

export function generatePublishTx({
  dir = defaultDir,
  manifest,
  releaseMultiHash,
  developerAddress,
  ethProvider,
  verbosityOptions
}: {
  manifest: Manifest;
  releaseMultiHash: string;
  developerAddress?: string;
  ethProvider: string;
  verbosityOptions: VerbosityOptions;
} & CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  // Init APM instance
  const ethereumUrl = getEthereumUrl(ethProvider);
  const apm = new ApmRepository(ethereumUrl);

  // Compute tx data
  const contentURI =
    "0x" + Buffer.from(releaseMultiHash, "utf8").toString("hex");
  const contractAddress = "0x0000000000000000000000000000000000000000";

  const { name: dnpName, version } = manifest;

  return new Listr<ListrContextBuildAndPublish>(
    [
      {
        title: "Generate transaction",
        task: async ctx => {
          const repository = await getRepoContractIfExists({
            apm,
            ensName: dnpName
          });

          const txData: TxData = repository
            ? await getTxDataForExistingRepo({
                repository,
                version,
                contractAddress,
                contentURI,
                releaseMultiHash,
                dnpName: dnpName
              })
            : await getTxDataForNewRepo({
                dnpName: dnpName,
                version,
                contractAddress,
                contentURI,
                releaseMultiHash,
                developerAddress,
                ethereumUrl
              });

          ctx[dnpName].txData = txData;

          /**
           * Write Tx data in a file for future reference
           */
          addReleaseTx({
            dir,
            version: manifest.version,
            link: getPublishTxLink(txData)
          });
        }
      }
    ],
    verbosityOptions
  );
}

async function getRepoContractIfExists({
  apm,
  ensName
}: {
  apm: ApmRepository;
  ensName: string;
}) {
  try {
    return await apm.getRepoContract(ensName);
  } catch (e) {
    if (e.message.includes("Could not resolve name")) return null;
    else throw e;
  }
}

/**
 * If the repo does not exist, a new repo needs to be created.
 * The developer address must be provided by the option -a or --developer_address in this case.
 */
function validateDeveloperAddress({
  dnpName,
  developerAddress
}: {
  dnpName: string;
  developerAddress?: string;
}): string {
  if (
    !developerAddress ||
    !ethers.isAddress(developerAddress) ||
    isZeroAddress(developerAddress)
  ) {
    throw new YargsError(
      `A new Aragon Package Manager Repo for ${dnpName} must be created. 
You must specify the developer address that will control it

with ENV:

DEVELOPER_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B dappnodesdk publish [type]

with command option:

dappnodesdk publish [type] --developer_address 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
`
    );
  }

  return developerAddress;
}

async function getTxDataForExistingRepo({
  repository,
  version,
  contractAddress,
  contentURI,
  releaseMultiHash,
  dnpName
}: {
  repository: Repo;
  version: string;
  contractAddress: string;
  contentURI: string;
  releaseMultiHash: string;
  dnpName: string;
}): Promise<TxData> {
  const to = await repository.getAddress();

  return {
    to,
    value: 0,
    data: encodeNewVersionCall({
      version,
      contractAddress,
      contentURI
    }),
    gasLimit: 300000,
    ensName: dnpName,
    currentVersion: version,
    releaseMultiHash
  };
}

async function getTxDataForNewRepo({
  dnpName,
  version,
  contractAddress,
  contentURI,
  releaseMultiHash,
  ethereumUrl,
  developerAddress
}: {
  dnpName: string;
  version: string;
  contractAddress: string;
  contentURI: string;
  releaseMultiHash: string;
  ethereumUrl: string;
  developerAddress?: string;
}): Promise<TxData> {
  const shortName = dnpName.split(".")[0];

  const registryAddress = await getRegistryAddressFromDnpName({
    ethereumUrl,
    dnpName
  });

  const validDevAddress = validateDeveloperAddress({
    dnpName,
    developerAddress
  });

  return {
    to: registryAddress,
    value: 0,
    data: encodeNewRepoWithVersionCall({
      name: shortName,
      developerAddress: validDevAddress,
      version,
      contractAddress,
      contentURI
    }),
    gasLimit: 1100000,
    ensName: dnpName,
    currentVersion: version,
    releaseMultiHash,
    developerAddress
  };
}

/**
 * newVersion(
 *   uint16[3] _newSemanticVersion,
 *   address _contractAddress,
 *   bytes _contentURI
 * )
 */
function encodeNewVersionCall({
  version,
  contractAddress,
  contentURI
}: {
  version: string;
  contractAddress: string;
  contentURI: string;
}): string {
  const repo = ethers.Interface.from(repoAbi);
  return repo.encodeFunctionData("newVersion", [
    semverToArray(version), // uint16[3] _newSemanticVersion
    contractAddress, // address _contractAddress
    contentURI // bytes _contentURI
  ]);
}

/**
 * newRepoWithVersion(
 *   string _name,
 *   address _dev,
 *   uint16[3] _initialSemanticVersion,
 *   address _contractAddress,
 *   bytes _contentURI
 * )
 */
function encodeNewRepoWithVersionCall({
  name,
  developerAddress,
  version,
  contractAddress,
  contentURI
}: {
  name: string;
  developerAddress: string;
  version: string;
  contractAddress: string;
  contentURI: string;
}): string {
  const registry = ethers.Interface.from(registryAbi);
  return registry.encodeFunctionData("newRepoWithVersion", [
    name, // string _name
    developerAddress, // address _dev
    semverToArray(version), // uint16[3] _initialSemanticVersion
    contractAddress, // address _contractAddress
    contentURI // bytes _contentURI
  ]);
}
