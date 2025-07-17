import { CliError } from "../params.js";
import { IReleaseUploader } from "./interface.js";
import { ReleaseUploaderIpfsNode } from "./ipfsNode/index.js";
import { ReleaseUploaderIpfsPinata } from "./pinata/index.js";
import { ReleaseUploaderSwarmNode } from "./swarmNode/index.js";

export * from "./interface.js";
export * from "./errors.js";

export type UploadTo = "ipfs" | "swarm";

export type ReleaseUploaderProvider =
  | {
      network: "ipfs";
      type: "node";
      url: string;
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

/**
 * Normalize common CLI args into a structured ReleaseUploaderProvider type
 * @param param0
 */
export function cliArgsToReleaseUploaderProvider({
  uploadTo,
  contentProvider
}: {
  uploadTo: UploadTo;
  contentProvider: string;
}): ReleaseUploaderProvider {
  switch (uploadTo) {
    case "ipfs":
      if (contentProvider === "pinata") {
        const { PINATA_API_KEY, PINATA_SECRET_API_KEY } = process.env;
        if (!PINATA_API_KEY) throw new CliError("Must provide PINATA_API_KEY");
        if (!PINATA_SECRET_API_KEY)
          throw new CliError("Must provide PINATA_SECRET_API_KEY");
        return {
          network: "ipfs",
          type: "pinata",
          apiKey: PINATA_API_KEY,
          secretApiKey: PINATA_SECRET_API_KEY
        };
      } else {
        return {
          network: "ipfs",
          type: "node",
          url: contentProvider
        };
      }

    case "swarm":
      return {
        network: "swarm",
        type: "node",
        swarmProvider: contentProvider
      };

    default:
      throw new CliError(`Unknown upload_to value '${uploadTo}'`);
  }
}
