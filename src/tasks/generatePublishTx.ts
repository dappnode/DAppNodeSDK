import Listr from "listr";
import { ethers } from "ethers";
import {


  getEthereumUrl
} from "../utils/getEthereumUrl.js";
import { getPublishTxLink } from "../utils/getLinks.js";
import { addReleaseTx } from "../utils/releaseRecord.js";
import { defaultDir, YargsError } from "../params.js";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types.js";
import { readManifest } from "../files/index.js";
import { ApmRepository } from "@dappnode/toolkit";
import registryAbi from "../contracts/ApmRegistryAbi.json" assert { type: "json" };
import { semverToArray } from "../utils/semverToArray.js";
import repoAbi from "../contracts/RepoAbi.json" assert { type: "json" };

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
  releaseMultiHash,
  developerAddress,
  ethProvider,
  verbose,
  silent
}: {
  releaseMultiHash: string;
  developerAddress?: string;
  ethProvider: string;
} & CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  // Init APM instance
  const ethereumUrl = getEthereumUrl(ethProvider);
  const apm = new ApmRepository(ethereumUrl);

  // Load manifest ##### Verify manifest object
  const { manifest } = readManifest({ dir });

  // Compute tx data
  const contentURI =
    "0x" + Buffer.from(releaseMultiHash, "utf8").toString("hex");
  const contractAddress = "0x0000000000000000000000000000000000000000";
  const currentVersion = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split(".")[0];

  return new Listr<ListrContextBuildAndPublish>(
    [
      {
        title: "Generate transaction",
        task: async ctx => {
          try {
            const repository = await apm.getRepoContract(ensName);
            // TODO: Fix
            ctx[ensName].txData = {
              to: await repository.getAddress(),
              value: 0,
              data: encodeNewVersionCall({
                version: currentVersion,
                contractAddress,
                contentURI
              }),
              gasLimit: 300000,
              ensName,
              currentVersion,
              releaseMultiHash
            };
          } catch (e) {
            if (e.message.includes("Could not resolve name")) {
              try {
                const registryAddress = await new ethers.JsonRpcProvider(
                  ethereumUrl
                ).resolveName(ensName.split(".").slice(1).join("."));
                if (!registryAddress)
                  throw new Error("Registry not found for " + ensName);

                // If repo does not exist, create a new repo and push version
                // A developer address must be provided by the option -a or --developer_address.
                if (
                  !developerAddress ||
                  !ethers.isAddress(developerAddress) ||
                  isZeroAddress(developerAddress)
                ) {
                  throw new YargsError(
                    `A new Aragon Package Manager Repo for ${ensName} must be created. 
You must specify the developer address that will control it

with ENV:

  DEVELOPER_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B dappnodesdk publish [type]

with command option:

  dappnodesdk publish [type] --developer_address 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
`
                  );
                }

                ctx[ensName].txData = {
                  to: registryAddress,
                  value: 0,
                  data: encodeNewRepoWithVersionCall({
                    name: shortName,
                    developerAddress,
                    version: currentVersion,
                    contractAddress,
                    contentURI
                  }),
                  gasLimit: 1100000,
                  ensName,
                  currentVersion,
                  releaseMultiHash,
                  developerAddress
                };
              } catch (e) {
                throw Error(
                  `There must exist a registry for DNP name ${ensName}`
                );
              }
            } else throw e;
          }

          /**
           * Write Tx data in a file for future reference
           */
          addReleaseTx({
            dir,
            version: manifest.version,
            link: getPublishTxLink(ctx[ensName].txData)
          });
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

// Utils


/**
 * newVersion(
 *   uint16[3] _newSemanticVersion,
 *   address _contractAddress,
 *   bytes _contentURI
 * )
 */
export function encodeNewVersionCall({
  version,
  contractAddress,
  contentURI
}: {
  version: string;
  contractAddress: string;
  contentURI: string;
}): string {
  const repo = ethers.Interface.from(repoAbi)
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
export function encodeNewRepoWithVersionCall({
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
  const registry = ethers.Interface.from(registryAbi)
  return registry.encodeFunctionData("newRepoWithVersion", [
    name, // string _name
    developerAddress, // address _dev
    semverToArray(version), // uint16[3] _initialSemanticVersion
    contractAddress, // address _contractAddress
    contentURI // bytes _contentURI
  ]);
}
