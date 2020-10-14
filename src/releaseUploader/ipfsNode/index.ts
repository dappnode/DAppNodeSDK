import { IReleaseUploader } from "../interface";
import { ipfsAddFromFs } from "./addFromFs";
import { verifyIpfsConnection } from "./verifyConnection";

export class ReleaseUploaderIpfsNode implements IReleaseUploader {
  networkName = "IPFS node";
  ipfsProvider: string;

  constructor({ ipfsProvider }: { ipfsProvider: string }) {
    this.ipfsProvider = ipfsProvider;
  }

  async addFromFs({
    dirPath,
    onProgress
  }: {
    dirPath: string;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    return await ipfsAddFromFs(dirPath, this.ipfsProvider, onProgress);
  }

  async testConnection(): Promise<void> {
    await verifyIpfsConnection(this.ipfsProvider);
  }
}
