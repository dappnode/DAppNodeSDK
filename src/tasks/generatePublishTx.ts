import Listr from "listr";
import { ethers } from "ethers";
import { getPublishTxLink } from "../utils/getLinks.js";
import { addReleaseTx } from "../utils/releaseRecord.js";
import { defaultDir, YargsError } from "../params.js";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types.js";
import { readManifest } from "../files/index.js";
import repoAbi from "../contracts/RepoAbi.json" assert { type: "json" };
import registryAbi from "../contracts/ApmRegistryAbi.json" assert { type: "json" };
import { semverToArray } from "../utils/semverToArray.js";
import { getEthereumUrl } from "../utils/getEthereumUrl.js";

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

  //
  const provider = new ethers.JsonRpcProvider(getEthereumUrl(ethProvider))

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
          isValidENSName(ensName);
          const repository = await provider.resolveName(ensName);
          if (repository) {
            ctx.txData = {
              to: repository,
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
            const registryAddress = await provider.resolveName(ensName.split(".").slice(1).join("."));
            if (!registryAddress)
              throw Error(
                `There must exist a registry for DNP name ${ensName}`
              );

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
/**
 *checks if the name is a valid ENS name. Returns all reasons why the name is not valid if it is not valid.
 * - ENS name must be between 1 and 63 characters.
 * - ENS name must contain only lowercase alphanumeric characters(a-z), hyphens(-) and dots(.).
 * - Labels must not start or end with a hyphen.
 * - Labels must not contain consecutive hyphens.
 * - Last label must be ".eth".

 */
export function isValidENSName(name: string): void {
  const invalidMessages: string[] = [];

  // Length Check
  if (name.length < 3 || name.length > 63) {
    invalidMessages.push('Length must be between 3 and 63 characters.');
  }

  // Character Check
  if (!/^[a-z0-9-.]+$/.test(name)) {
    invalidMessages.push('Contains forbidden characters.');
  }

  // Hyphen Placement Check
  if (name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
    invalidMessages.push('Hyphen placement is not allowed.');
  }

  const labels = name.split(".");
  // Last Label Check
  const tld = labels[labels.length - 1];
  if (tld.toLowerCase() !== "eth") {
    invalidMessages.push('Last label must be ".eth".');
  }

  if (invalidMessages.length > 0) {
    throw new Error(`Invalid ENS name: ${invalidMessages.join(' ')}`);
  }
}