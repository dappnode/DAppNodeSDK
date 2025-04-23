import { IReleaseUploader } from "../interface.js";
import { ipfsAddFromFs } from "./addFromFs.js";
import { normalizeIpfsProvider } from "./ipfsProvider.js";
import { verifyIpfsConnection } from "./verifyConnection.js";

export class ReleaseUploaderIpfsNode implements IReleaseUploader {
  networkName = "IPFS node";
  apiUrl: string;

  constructor({ ipfsProvider }: { ipfsProvider: string }) {
    this.apiUrl = normalizeIpfsProvider(ipfsProvider);
  }

  async addFromFs({
    dirPath,
    onProgress
  }: {
    dirPath: string;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    return await ipfsAddFromFs(dirPath, this.apiUrl, onProgress);
  }

  async testConnection(): Promise<void> {
    await verifyIpfsConnection(this.apiUrl);
  }

  ipfsApiUrl(): string {
      return this.apiUrl;
  }
}
