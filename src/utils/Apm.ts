import { ethers } from "ethers";
import repoAbi from "../contracts/RepoAbi.json" assert { type: "json" };
import registryAbi from "../contracts/ApmRegistryAbi.json" assert { type: "json" };
import { semverToArray } from "./semverToArray.js";

export function getEthereumProviderUrl(provider = "dappnode"): string {
  if (provider === "dappnode") {
    return "http://fullnode.dappnode:8545";
  } else if (provider === "remote") {
    return "https://web3.dappnode.net";
  } else if (provider === "infura") {
    // Make sure to change this common Infura token
    // if it stops working or you prefer to use your own
    return "https://mainnet.infura.io/v3/bb15bacfcdbe45819caede241dcf8b0d";
  } else {
    return provider;
  }
}
/**
 *checks if the name is a valid ENS name. This means:
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
