export interface PinataMetadata {
  /**
   * A custom string to use as the name for your content
   */
  name?: string;
  /**
   * An object containing up to 10 custom key / value pairs.
   * The values can be: strings, numbers, dates
   */
  keyvalues?: { [key: string]: string | number | undefined };
}

export interface PinataOptions {
  /**
   * The CID version IPFS will use when creating a hash for your content
   */
  cidVerson?: 0 | 1;
  /**
   * Tells IPFS to wrap your content in a directory to preserve the content's original name.
   * See this blog post for more details on what this does
   */
  wrapWithDirectory?: boolean;
  /**
   * a custom Pin Policy for the piece of content being pinned.
   * Providing a custom pin policy as part of a request means that the content being
   * pinned will be replicated differently from the user's default pin policy
   * found under the Account page
   */
  customPinPolicy?: PinPolicy;
}

export interface PinPolicy {
  regions: {
    id: "FRA1" | "NYC1";
    desiredReplicationCount: number;
  }[];
}

export interface IpfsUploadResult {
  /**
   * This is the IPFS multi-hash provided back for your content,
   * `"QmQhmhw7wh5cdSwCFoWf5txwAZ9f2y1RWfa4z6GFcuzSsG"`
   */
  IpfsHash: string;
  /**
   *  This is how large (in bytes) the content you just pinned is,
   * `10110`
   */
  PinSize: string;
  /**
   * This is the timestamp for your content pinning (represented in ISO 8601 format)
   * `"2020-10-14T15:24:19.466Z"`
   */
  Timestamp: string;
}
