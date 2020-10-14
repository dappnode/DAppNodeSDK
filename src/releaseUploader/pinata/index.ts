import { IReleaseUploader } from "../interface";
import { Pinata, PinataMetadata, pinataSDK } from "./PinataSDK";
import { pinataAddFromFs } from "./addDirFromFs";

export class ReleaseUploaderIpfsPinata implements IReleaseUploader {
  networkName = "IPFS Pinata";

  private pinata: Pinata;
  private apiKey: string;
  private secretApiKey: string;
  private pinataUrl = "https://api.pinata.cloud";

  constructor({
    apiKey,
    secretApiKey
  }: {
    apiKey: string;
    secretApiKey: string;
  }) {
    this.pinata = pinataSDK(apiKey, secretApiKey);
    this.apiKey = apiKey;
    this.secretApiKey = secretApiKey;
  }

  async addFromFs({
    dirPath,
    metadata,
    onProgress
  }: {
    dirPath: string;
    metadata: PinataMetadata;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    return await pinataAddFromFs({
      dirOrFilePath: dirPath,
      pinataUrl: this.pinataUrl,
      pinataMetadata: metadata,
      credentials: { apiKey: this.apiKey, secretApiKey: this.secretApiKey },
      onProgress
    });
  }

  async testConnection(): Promise<void> {
    return await this.pinata.testAuthentication();
  }
}
