import Listr from "listr";
import { ethers } from "ethers";
import {
  encodeNewVersionCall,
  encodeNewRepoWithVersionCall,
  getEthersProvider
} from "../utils/Apm.js";
import { getPublishTxLink } from "../utils/getLinks.js";
import { addReleaseTx } from "../utils/releaseRecord.js";
import { defaultDir, YargsError } from "../params.js";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types.js";
import { readManifest } from "../files/index.js";
import { ApmRepository } from "@dappnode/toolkit";

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
  const provider = getEthersProvider(ethProvider);
  const apm = new ApmRepository(provider);

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
          const repository = await apm.getRepoContract(ensName);
          if (repository) {
            ctx.txData = {
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
          } else {
            try {
              const registryAddress = await provider.resolveName(
                ensName.split(".").slice(1).join(".")
              );
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

              ctx.txData = {
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
          }

          /**
           * Write Tx data in a file for future reference
           */
          addReleaseTx({
            dir,
            version: manifest.version,
            link: getPublishTxLink(ctx.txData)
          });
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}
