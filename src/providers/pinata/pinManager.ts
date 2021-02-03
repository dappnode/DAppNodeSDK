import got from "got";
import { PINATA_URL } from "../../params";
import { PinItem } from "../../releaseUploader/pinata";

interface PinataCredentials {
  apiKey: string;
  secretApiKey: string;
}

/**
 * Class with extra methods to manage pins
 */
export class PinataPinManager {
  private apiKey: string;
  private secretApiKey: string;
  private pinataUrl = PINATA_URL;

  constructor({ apiKey, secretApiKey }: PinataCredentials) {
    this.apiKey = apiKey;
    this.secretApiKey = secretApiKey;
  }

  /**
   * GET https://api.pinata.cloud/data/pinList
   * This endpoint returns data on what content the sender has pinned to IPFS through Pinata.
   * The purpose of this endpoint is to provide insight into what is being pinned, and how long it has been pinned.
   * The results of this call can be filtered using multiple query parameters that will be discussed below.
   */
  async pinList<PinKeyvalues>(filters?: {
    name?: string;
    status?: "all" | "pinned" | "unpinned";
    keyvalues?: {
      // Each query on custom values takes the form of an object with a "value" key, and an "op" key.
      // The "value" is fairly straightforward. This is simply the value that you wish your query operation to be applied to
      // The "op" is what query operation will be applied to the value you provided.
      [key: string]: {
        value: string | number;
        op: "gt" | "gte" | "lt" | "lte" | "ne" | "eq";
      };
    };
  }): Promise<PinItem<PinKeyvalues>[]> {
    // To query on both the metadata name and multiple keyvalue attributes
    // ?metadata[name]=exampleName
    // &metadata[keyvalues]={"exampleKey":{"value":"exampleValue","op":"exampleOp"},"exampleKey2":{"value":"exampleValue2","op":"exampleOp2"}}
    const searchParams: Record<string, string> = {};
    if (filters?.name) searchParams["metadata[name]"] = filters.name;

    if (filters?.keyvalues)
      searchParams["metadata[keyvalues]"] = JSON.stringify(filters.keyvalues);

    // Fetch only "pinned" items by default
    searchParams["status"] = filters?.status || "pinned";

    // Note: Results in rows will be limited to 1000, in case of needing more pagination should be implemented
    try {
      const result: { count: number; rows: PinItem<PinKeyvalues>[] } = await got
        .get({
          prefixUrl: this.pinataUrl,
          url: "data/pinList",
          headers: {
            pinata_api_key: this.apiKey,
            pinata_secret_api_key: this.secretApiKey
          },
          searchParams
        })
        .json();

      return result.rows;
    } catch (e) {
      e.message = `Error on Pinata pinList: ${e.message}`;
      throw e;
    }
  }

  /**
   * DELETE https://api.pinata.cloud/pinning/unpin
   * This endpoint allows the sender to unpin content they previously uploaded to Pinata's IPFS nodes
   * @param hashToUnpin QmaEqNCwRxdA6SLLxntT2xbsUgqxMfGVCwoHuyXjczoQwN
   */
  async unpin(hashToUnpin: string): Promise<void> {
    try {
      const res = await got.delete({
        prefixUrl: this.pinataUrl,
        url: `pinning/unpin/${hashToUnpin}`,
        headers: {
          pinata_api_key: this.apiKey,
          pinata_secret_api_key: this.secretApiKey
        },
        throwHttpErrors: false
      });

      if (res.statusCode !== 200) {
        throw Error(
          `Error on Pinata unpin: ${res.statusCode} ${res.statusMessage} - ${res.body}`
        );
      }
    } catch (e) {
      e.message = `Error on Pinata unpin: ${e.message}`;
      throw e;
    }
  }
}
