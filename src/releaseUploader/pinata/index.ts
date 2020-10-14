import { IReleaseUploader } from "../interface";
import { Pinata, PinataMetadata, pinataSDK } from "./PinataSDK";
import { pinataAddFromFs } from "./addDirFromFs";
import { Manifest } from "../../types";

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
    manifest,
    onProgress
  }: {
    dirPath: string;
    manifest: Manifest;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    const metadata: PinataMetadata = {
      name: `${manifest.name} ${manifest.version}`,
      keyvalues: {
        name: manifest.name,
        version: manifest.version,
        upstreamVersion: manifest.upstreamVersion
        // commit: "aafaafafafafafafaa"
      }
    };
    return await pinataAddFromFs(
      dirPath,
      this.pinataUrl,
      metadata,
      { apiKey: this.apiKey, secretApiKey: this.secretApiKey },
      onProgress
    );
  }

  async testConnection(): Promise<void> {
    return await this.pinata.testAuthentication();
  }
}
