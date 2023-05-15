import got, { Response } from "got";
import {
  StakerConfigSet,
  StakerConfigGet,
  InstalledPackageDetailData,
  InstalledPackageDataApiReturn,
  PackageToInstall,
  IpfsRepository
} from "./types.js";
import { Network } from "@dappnode/types";

export class DappmanagerTestApi {
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  /**
   * Health check of the DAppNode
   */
  async healthCheck(): Promise<void> {
    const response = await got(`${this.url}/ping`);
    if (response.statusCode !== 200) throw Error("Health check failed");
  }

  /**
   * Get the list of installed packages
   *
   * @returns list of packages
   * @throws Error if request fails
   */
  async packagesGet(): Promise<InstalledPackageDataApiReturn[]> {
    return JSON.parse(
      (await (await this.ensureSuccess(await got(`${this.url}/packagesGet`)))
        .body) as string
    ) as InstalledPackageDataApiReturn[];
  }

  /**
   * Get a package by its dnpName
   *
   * @param dnpName name of the package
   * @returns package object
   * @throws Error if package not found
   */
  async packageGet(dnpName: string): Promise<InstalledPackageDetailData> {
    return JSON.parse(
      (await (
        await this.ensureSuccess(
          await got(`${this.url}/packageGet`, { json: { dnpName } })
        )
      ).body) as string
    ) as InstalledPackageDetailData;
  }

  /**
   * Installs a package
   *
   * @param dnpName name of the package. It may be an ipfs hash or a dnpName
   * @param version version of the package
   * @param userSettings user settings for the package
   * @throws Error if request fails
   */
  async packageInstall({
    dnpName,
    version,
    userSettings
  }: PackageToInstall): Promise<void> {
    const options = {
      BYPASS_RESOLVER: true,
      BYPASS_CORE_RESTRICTION: true,
      BYPASS_SIGNED_RESTRICTION: true
    };

    await this.ensureSuccess(
      await got.post(`${this.url}/packageInstall`, {
        json: {
          name: dnpName,
          version,
          options,
          userSettings
        }
      })
    );
  }

  /**
   * Removes a package
   *
   * @param dnpName name of the package
   * @param deleteVolumes delete volumes of the package
   * @throws Error if request fails
   */
  async packageRemove({
    dnpName,
    deleteVolumes = true
  }: {
    dnpName: string;
    deleteVolumes?: boolean;
  }): Promise<void> {
    await this.ensureSuccess(
      await got.post(`${this.url}/packageRemove`, {
        json: { dnpName, deleteVolumes }
      })
    );
  }

  /**
   * Sets staker config
   *
   * @param stakerConfig staker config
   * @throws Error if request fails
   */
  async stakerConfigSet<T extends Network>(
    stakerConfig: StakerConfigSet<T>
  ): Promise<void> {
    await this.ensureSuccess(
      await got.post(`${this.url}/stakerConfigSet`, {
        json: { stakerConfig: stakerConfig }
      })
    );
  }

  /**
   * Gets staker config
   *
   * @param network network to get the staker config
   * @returns staker config
   * @throws Error if request fails
   */
  async stakerConfigGet<T extends Network>(
    network: T
  ): Promise<StakerConfigGet<T>> {
    return JSON.parse(
      (await (
        await this.ensureSuccess(
          await got.post(`${this.url}/stakerConfigGet`, { json: { network } })
        )
      ).body) as string
    ) as StakerConfigGet<T>;
  }

  /**
   * Get the IPFS client target
   *
   * @returns IPFS client target
   * @throws Error if request fails
   */
  async ipfsClientTargetGet(): Promise<IpfsRepository> {
    return JSON.parse(
      (await (
        await this.ensureSuccess(await got(`${this.url}/ipfsClientTargetGet`))
      ).body) as string
    ) as IpfsRepository;
  }

  /**
   * Set the IPFS client target
   *
   * @param ipfsRepository IPFS repository
   * @param deleteLocalIpfsClient delete local IPFS client
   *
   * @throws Error if request fails
   */
  async ipfsClientTargetSet({
    ipfsRepository,
    deleteLocalIpfsClient
  }: {
    ipfsRepository: IpfsRepository;
    deleteLocalIpfsClient?: boolean;
  }): Promise<void> {
    await this.ensureSuccess(
      await got.post(`${this.url}/ipfsClientTargetSet`, {
        json: { ipfsRepository, deleteLocalIpfsClient }
      })
    );
  }

  async packageRestartVolumes({ dnpName }: { dnpName: string }): Promise<void> {
    await this.ensureSuccess(
      await got.post(`${this.url}/packageRestartVolumes`, {
        json: { dnpName }
      })
    );
  }

  /**
   * Middleware: throw error if http code !==2xx
   */
  private async ensureSuccess(response: Response): Promise<Response> {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Error(
        `Request failed with code ${response.statusCode}: ${response.statusMessage}`
      );
    }
    return response;
  }
}
