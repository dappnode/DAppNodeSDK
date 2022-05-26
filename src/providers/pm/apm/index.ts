import { ethers } from "ethers";
import repoAbi from "./RepoAbi.json";
import registryAbi from "./ApmRegistryAbi.json";
import { arrayToSemver } from "../../../utils/arrayToSemver";
import { semverToArray } from "../../../utils/semverToArray";
import { IPM, TxInputs, TxSummary } from "../interface";
import { YargsError } from "../../../params";

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

const zeroAddress = "0x0000000000000000000000000000000000000000";

/**
 * @param provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "http://localhost:8545"
 * - "ws://localhost:8546"
 * @return apm instance
 */
export class Apm implements IPM {
  private provider: ethers.providers.JsonRpcProvider;

  constructor(readonly ethProvider: string) {
    // Initialize ens and web3 instances
    // Use http Ids to avoid opened websocket connection
    // This application does not need subscriptions and performs very few requests per use
    const providerUrl = getEthereumProviderUrl(ethProvider);

    this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
  }

  isListening(): Promise<boolean> {
    return this.provider.send("net_listening", []);
  }

  async populatePublishTransaction({
    dnpName,
    version,
    releaseMultiHash,
    developerAddress
  }: TxInputs): Promise<TxSummary> {
    // TODO: Ensure APM format
    const contentURI =
      "0x" + Buffer.from(releaseMultiHash, "utf8").toString("hex");

    const repository = await this.getRepoContract(dnpName);
    if (repository) {
      const repo = new ethers.utils.Interface(repoAbi);
      // newVersion(
      //   uint16[3] _newSemanticVersion,
      //   address _contractAddress,
      //   bytes _contentURI
      // )
      const txData = repo.encodeFunctionData("newVersion", [
        semverToArray(version), // uint16[3] _newSemanticVersion
        zeroAddress, // address _contractAddress
        contentURI // bytes _contentURI
      ]);

      return {
        to: repository.address,
        value: 0,
        data: txData,
        gasLimit: 300000
      };
    }

    // If repository does not exist, deploy new one
    else {
      const registry = await this.getRegistryContract(dnpName);
      if (!registry) {
        throw Error(`There must exist a registry for DNP name ${dnpName}`);
      }

      // newRepoWithVersion(
      //   string _name,
      //   address _dev,
      //   uint16[3] _initialSemanticVersion,
      //   address _contractAddress,
      //   bytes _contentURI
      // )
      const registryInt = new ethers.utils.Interface(registryAbi);
      const txData = registryInt.encodeFunctionData("newRepoWithVersion", [
        getShortName(dnpName), // string _name
        ensureValidDeveloperAddress(developerAddress), // address _dev
        semverToArray(version), // uint16[3] _initialSemanticVersion
        zeroAddress, // address _contractAddress
        contentURI // bytes _contentURI
      ]);

      return {
        to: registry.address,
        value: 0,
        data: txData,
        gasLimit: 300000
      };
    }
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
      if ((e as Error).message.includes("ENS name not defined")) return null;
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
      const registry = await this.getRegistryContract(ensName);
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
      (e as Error).message = `Error getting latest version of ${ensName}: ${
        (e as Error).message
      }`;
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
  private async getRepoContract(
    ensName: string
  ): Promise<ethers.Contract | null> {
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
  private async getRegistryContract(
    ensName: string
  ): Promise<ethers.Contract | null> {
    const repoId = ensName.split(".").slice(1).join(".");
    const registryAddress = await this.resolve(repoId);
    if (!registryAddress) return null;
    return new ethers.Contract(registryAddress, registryAbi, this.provider);
  }
}

/** Short name is the last part of an ENS name */
function getShortName(dnpName: string): string {
  return dnpName.split(".")[0];
}

function ensureValidDeveloperAddress(address: string | undefined): string {
  if (
    !address ||
    !ethers.utils.isAddress(address) ||
    // check if is zero address
    parseInt(address) === 0
  ) {
    throw new YargsError(
      `A new Aragon Package Manager Repo must be created. 
You must specify the developer address that will control it

with ENV:

DEVELOPER_ADDRESS=0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B dappnodesdk publish [type]

with command option:

dappnodesdk publish [type] --developer_address 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
`
    );
  }

  return address;
}
