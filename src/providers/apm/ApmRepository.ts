import {
  Contract,
  JsonRpcProvider,
  toUtf8String,
  type Provider,
  isValidName
} from "ethers";
import repoAbi from "../../contracts/RepoAbi.json" with { type: "json" };

/** The SDK only needs ENS resolution and the latest published APM version. */
export class ApmRepository {
  private readonly provider: Provider;

  constructor(ethereumUrl: string, provider?: Provider) {
    if (!ethereumUrl) throw new Error("Ethereum URL is required");
    this.provider =
      provider ||
      new JsonRpcProvider(ethereumUrl, "mainnet", { staticNetwork: true });
  }

  async getRepoContract(name: string): Promise<Contract> {
    if (!isValidName(name) || !name.endsWith(".dappnode.eth"))
      throw new Error(`Invalid Dappnode ENS name: ${name}`);
    const address = await this.provider.resolveName(name);
    if (!address) throw new Error(`Could not resolve name ${name}: NOREPO`);
    return new Contract(address, repoAbi, this.provider);
  }

  async getVersionAndIpfsHash({
    dnpNameOrHash
  }: {
    dnpNameOrHash: string;
  }): Promise<{ version: string; contentUri: string }> {
    const repo = await this.getRepoContract(dnpNameOrHash);
    const result = await repo.getFunction("getLatest").staticCall();
    const version: unknown = result[0];
    if (!Array.isArray(version) || version.length !== 3)
      throw new Error(`Invalid APM semantic version for ${dnpNameOrHash}`);
    return {
      version: version.map(part => String(part)).join("."),
      contentUri: toUtf8String(result[2])
    };
  }
}
