import { ethers, Provider } from "ethers";
import repoAbi from "../contracts/RepoAbi.json" assert { type: "json" };
import registryAbi from "../contracts/ApmRegistryAbi.json" assert { type: "json" };
import { semverToArray } from "./semverToArray.js";

export function getEthersProvider(provider = "dappnode"): Provider {
  if (provider === "dappnode") {
    return new ethers.JsonRpcProvider("http://fullnode.dappnode:8545")
  } else if (provider === "remote") {
    return new ethers.JsonRpcProvider("https://web3.dappnode.net");
  } else if (provider === "infura") {
    // Make sure to change this common Infura token
    // if it stops working or you prefer to use your own
    return new ethers.InfuraProvider("mainnet", "bb15bacfcdbe45819caede241dcf8b0d")
  } else {
    return new ethers.JsonRpcProvider(provider);
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
