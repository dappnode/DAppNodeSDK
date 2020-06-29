import Eth from "ethjs";
import ENS from "ethjs-ens";
import { arrayToSemver } from "../utils/arrayToSemver";
import repoAbi from "../contracts/RepoAbi.json";
import registryAbi from "../contracts/ApmRegistryAbi.json";

function getEthereumProviderUrl(provider = "dappnode") {
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
 *
 * @param provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "http://localhost:8545"
 * - "ws://localhost:8546"
 * @return apm instance
 */
export function Apm(providerId: string) {
  // Initialize ens and web3 instances
  // Use http Ids to avoid opened websocket connection
  // This application does not need subscriptions and performs very few requests per use
  const providerUrl = getEthereumProviderUrl(providerId);

  const provider = new Eth.HttpProvider(providerUrl);
  const eth = new Eth(provider);
  const ens = new ENS({ provider, network: "1" });

  // Ens throws if a node is not found
  //
  // ens.resolver('admin.dnp.dappnode.eth').addr()
  // ==> 0xee66c4765696c922078e8670aa9e6d4f6ffcc455
  // ens.resolver('fake.dnp.dappnode.eth').addr()
  // ==> Unhandled rejection Error: ENS name not found
  //
  // Change behaviour to return null if not found
  async function resolve(ensDomain: string) {
    try {
      return await ens.lookup(ensDomain);
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
  async function getLatestVersion(ensName: string) {
    if (!ensName)
      throw Error("getLatestVersion first argument ensName must be defined");
    const repository = await getRepoContract(ensName);
    if (!repository) {
      const registry = getRegistryContract(ensName);
      if (registry)
        throw Error(
          `Error NOREPO: you must first deploy the repo of ${ensName} using the command publish`
        );
      else
        throw Error(
          `Error: there must exist a registry for DNP name ${ensName}`
        );
    }
    return repository
      .getLatest()
      .then(res => arrayToSemver(res.semanticVersion))
      .catch(e => {
        // Rename error for user comprehension
        e.message = `Error getting latest version of ${ensName}: ${e.message}`;
        throw e;
      });
    // return arrayToSemver(res.semanticVersion);
  }

  /**
   * Get the APM repo contract for an ENS domain.
   * ENS domain:      admin.dnp.dappnode.eth
   *
   * @param ensName: "admin.dnp.dappnode.eth"
   * @return contract instance of the Repo "admin.dnp.dappnode.eth"
   */
  async function getRepoContract(ensName: string) {
    if (!ensName)
      throw Error("getRepoContract first argument ensName must be defined");
    const repoAddress = await resolve(ensName);
    if (!repoAddress) return null;
    return eth.contract(repoAbi).at(repoAddress);
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
  async function getRegistryContract(ensName: string) {
    if (!ensName)
      throw Error("getRegistryContract first argument ensName must be defined");
    const repoId = ensName.split(".").slice(1).join(".");
    const registryAddress = await resolve(repoId);
    if (!registryAddress) return null;
    return eth.contract(registryAbi).at(registryAddress);
  }

  // return exposed methods
  return {
    getLatestVersion,
    getRepoContract,
    getRegistryContract,
    providerUrl,
    provider
  };
}
