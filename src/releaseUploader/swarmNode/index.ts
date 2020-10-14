import { IReleaseUploader } from "../interface";
import { swarmAddDirFromFs } from "./addDirFromFs";
import { getSwarmGatewayUrl } from "./provider";

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
