import got, { Response } from "got";

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
  async packagesGet(): Promise<any> {
    return (await this.ensureSuccess(await got(`${this.url}/packagesGet`)))
      .body;
  }

  /**
   * Get a package by its dnpName
   *
   * @param dnpName name of the package
   * @returns package object
   * @throws Error if package not found
   */
  async packageGet(dnpName: string): Promise<any> {
    return (
      await this.ensureSuccess(
        await got(`${this.url}/packageGet?dnpName=${dnpName}`)
      )
    ).body;
  }

  /**
   * Installs a package
   *
   * @param name name of the package. It may be an ipfs hash or a dnpName
   * @param version version of the package
   * @param userSettings user settings for the package
   * @throws Error if request fails
   */
  async packageInstall({
    name,
    version,
    userSettings
  }: {
    name: string;
    version?: string;
    userSettings?: {
      environment?: Record<string, string>;
      ports?: Record<string, number>;
      volumes?: Record<string, string>;
    };
  }): Promise<void> {
    const options = {
      BYPASS_RESOLVER: true,
      BYPASS_CORE_RESTRICTION: true,
      BYPASS_SIGNED_RESTRICTION: true
    };

    await this.ensureSuccess(
      await got(
        `${
          this.url
        }/packageInstall?name=${name}&version=${version}&options=${JSON.stringify(
          options
        )}&userSettings=${JSON.stringify(userSettings)}`
      )
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
    deleteVolumes = false
  }: {
    dnpName: string;
    deleteVolumes?: boolean;
  }): Promise<void> {
    await this.ensureSuccess(
      await got(
        `${this.url}/packageRemove?dnpName=${dnpName}&deleteVolumes=${deleteVolumes}`
      )
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
