import { CliError } from "../params";
import { IReleaseUploader } from "./interface";
import { ReleaseUploaderIpfsNode } from "./ipfsNode";
import { ReleaseUploaderIpfsPinata } from "./pinata";
import { ReleaseUploaderSwarmNode } from "./swarmNode";

export * from "./interface";
export * from "./errors";

type ReleaseUploaderProvider =
  | {
      network: "ipfs";
      type: "node";
      ipfsProvider: string;
    }
  | {
      network: "ipfs";
      type: "pinata";
      apiKey: string;
      secretApiKey: string;
    }
  | {
      network: "swarm";
      type: "node";
      swarmProvider: string;
    };

export function getReleaseUploader(
  provider: ReleaseUploaderProvider
): IReleaseUploader {
  switch (provider.network) {
    case "ipfs":
      switch (provider.type) {
        case "node":
          return new ReleaseUploaderIpfsNode(provider);
        case "pinata":
          return new ReleaseUploaderIpfsPinata(provider);
        default:
          throw new ErrorUnknownProvider(provider);
      }

    case "swarm":
      switch (provider.type) {
        case "node":
          return new ReleaseUploaderSwarmNode(provider);
        default:
          throw new ErrorUnknownProvider(provider);
      }

    default:
      throw new ErrorUnknownProvider(provider);
  }
}

class ErrorUnknownProvider extends CliError {
  constructor(provider: ReleaseUploaderProvider) {
    super(`Provider not supported: ${provider.network} ${provider.type}`);
  }
}
