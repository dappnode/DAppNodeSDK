import { PinataMetadata } from "./pinata/PinataSDK";

export interface IReleaseUploader {
  /**
   * "IPFS", "SWARM"
   */
  networkName: string;

  /**
   * Returns a publishable encoded multiHash ready to publish to APM
   * @return "/ipfs/QmeB8ViED9aVaH7sz7o4zwk9MPnABDg51o4Rg5fVwtXVxq",
   *         "/bzz/a5e0183cee00112..."
   */
  addFromFs(kwargs: {
    dirPath: string;
    metadata: PinataMetadata;
    onProgress?: (percent: number) => void;
  }): Promise<string>;

  /**
   * Resolves if connection is okay. Rejects otherwise
   */
  testConnection(): Promise<void>;
}
