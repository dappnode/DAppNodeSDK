import { IReleaseUploader } from "../interface.js";
import { ipfsAddFromFs } from "./addFromFs.js";
import { normalizeIpfsProvider } from "./ipfsProvider.js";
import { create, KuboRPCClient } from "kubo-rpc-client";

export class ReleaseUploaderIpfsNode implements IReleaseUploader {
  networkName = "IPFS node";
  kuboClient: KuboRPCClient;

  constructor({ url }: { url: string }) {
    this.kuboClient = create({ url: normalizeIpfsProvider(url) });
  }

  async addFromFs({
    dirPath,
    onProgress
  }: {
    dirPath: string;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    return await ipfsAddFromFs(dirPath, this.kuboClient, onProgress);
  }

  async testConnection(): Promise<void> {
    await this.kuboClient.version();
  }
}
