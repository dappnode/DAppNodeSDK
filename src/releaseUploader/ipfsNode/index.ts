import { IReleaseUploader } from "../interface.js";
import { ipfsAddFromFs } from "./addFromFs.js";
import { verifyIpfsConnection } from "./verifyConnection.js";

export class ReleaseUploaderIpfsNode implements IReleaseUploader {
  networkName = "IPFS node";
  ipfsProvider: string;

  constructor({ ipfsProvider }: { ipfsProvider: string }) {
    this.ipfsProvider = ipfsProvider;
  }

  async addFromFs({
    dirPath,
    onProgress,
    onUploadComplete
  }: {
    dirPath: string;
    onProgress?: (percent: number) => void;
    onUploadComplete?: () => void;
  }): Promise<string> {
    return await ipfsAddFromFs(
      dirPath,
      this.ipfsProvider,
      onProgress,
      onUploadComplete
    );
  }

  async testConnection(): Promise<void> {
    await verifyIpfsConnection(this.ipfsProvider);
  }
}
