import { IReleaseUploader } from "../interface.js";
import { swarmAddDirFromFs } from "./addDirFromFs.js";
import { getSwarmGatewayUrl } from "./provider.js";

export class ReleaseUploaderSwarmNode implements IReleaseUploader {
  networkName = "Swarm node";
  gatewayUrl: string;

  constructor({ swarmProvider }: { swarmProvider: string }) {
    this.gatewayUrl = getSwarmGatewayUrl(swarmProvider);
  }

  async addFromFs({
    dirPath,
    onProgress
  }: {
    dirPath: string;
    onProgress?: (percent: number) => void;
  }): Promise<string> {
    return await swarmAddDirFromFs(dirPath, this.gatewayUrl, onProgress);
  }

  async testConnection(): Promise<void> {
    // ### TODO
  }
}
