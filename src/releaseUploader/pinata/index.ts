import got from "got";
import { IReleaseUploader } from "../interface";
import { PinataMetadata } from "./PinataSDK";
import { pinataAddFromFs } from "./addDirFromFs";

export class ReleaseUploaderIpfsPinata implements IReleaseUploader {
  networkName = "IPFS Pinata";

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
    const res = await got.get({
      prefixUrl: this.pinataUrl,
      url: "data/testAuthentication",
      headers: {
        pinata_api_key: this.apiKey,
        pinata_secret_api_key: this.secretApiKey
      }
    });
    if (res.statusCode !== 200) {
      throw Error(`Error authenticating: ${res.statusCode}`);
    }
  }
}
