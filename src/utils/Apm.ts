import { ethers } from "ethers";
import { arrayToSemver } from "../utils/arrayToSemver";
import repoAbi from "../contracts/RepoAbi.json";
import registryAbi from "../contracts/ApmRegistryAbi.json";
import { semverToArray } from "./semverToArray";

function getEthereumProviderUrl(provider = "dappnode"): string {
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
 * @param provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "http://localhost:8545"
 * - "ws://localhost:8546"
 * @return apm instance
 */
export class Apm {
  provider: ethers.providers.JsonRpcProvider;

  constructor(providerId: string) {
    // Initialize ens and web3 instances
    // Use http Ids to avoid opened websocket connection
    // This application does not need subscriptions and performs very few requests per use
    const providerUrl = getEthereumProviderUrl(providerId);

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
  }

  // Ens throws if a node is not found
  //
  // ens.resolver('admin.dnp.dappnode.eth').addr()
  // ==> 0xee66c4765696c922078e8670aa9e6d4f6ffcc455
  // ens.resolver('fake.dnp.dappnode.eth').addr()
  // ==> Unhandled rejection Error: ENS name not found
  //
  // Change behaviour to return null if not found
  async resolve(ensDomain: string): Promise<string | null> {
    try {
      return await this.provider.resolveName(ensDomain);
    } catch (e) {
      // This error is particular for ethjs
      if (e.message.includes("ENS name not defined")) return null;
      else throw e;
    }
  }

  /**
   * Get the lastest version of an APM repo contract for an ENS domain.
   *
   * @param ensName: "admin.dnp.dappnode.eth"
   * @return latest semver version = '0.1.0'
   */
  async getLatestVersion(ensName: string): Promise<string> {
    if (!ensName)
      throw Error("getLatestVersion first argument ensName must be defined");
    const repository = await this.getRepoContract(ensName);
    if (!repository) {
      const registry = this.getRegistryContract(ensName);
      if (registry)
        throw Error(
          `Error NOREPO: you must first deploy the repo of ${ensName} using the command publish`
        );
      else
        throw Error(
          `Error: there must exist a registry for DNP name ${ensName}`
        );
    }

    try {
      const res = await repository.getLatest();
      return arrayToSemver(res.semanticVersion);
    } catch (e) {
      // Rename error for user comprehension
      e.message = `Error getting latest version of ${ensName}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Get the APM repo contract for an ENS domain.
   * ENS domain:      admin.dnp.dappnode.eth
   *
   * @param ensName: "admin.dnp.dappnode.eth"
   * @return contract instance of the Repo "admin.dnp.dappnode.eth"
   */
  async getRepoContract(ensName: string): Promise<ethers.Contract | null> {
    const repoAddress = await this.resolve(ensName);
    if (!repoAddress) return null;
    return new ethers.Contract(repoAddress, repoAbi, this.provider);
  }

  /**
   * Get the APM registry contract for an ENS domain.
   * It will slice the first subdomain and query the rest as:
   * ENS domain:      admin.dnp.dappnode.eth
   * Registry domain:       dnp.dappnode.eth
   *
   * @param ensName: "admin.dnp.dappnode.eth"
   * @return contract instance of the Registry "dnp.dappnode.eth"
   */
  async getRegistryContract(ensName: string): Promise<ethers.Contract | null> {
    const repoId = ensName.split(".").slice(1).join(".");
    const registryAddress = await this.resolve(repoId);
    if (!registryAddress) return null;
    return new ethers.Contract(registryAddress, registryAbi, this.provider);
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
  const repo = new ethers.utils.Interface(repoAbi);
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
  const registry = new ethers.utils.Interface(registryAbi);
  return registry.encodeFunctionData("newRepoWithVersion", [
    name, // string _name
    developerAddress, // address _dev
    semverToArray(version), // uint16[3] _initialSemanticVersion
    contractAddress, // address _contractAddress
    contentURI // bytes _contentURI
  ]);
}
