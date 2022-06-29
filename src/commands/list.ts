import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../types";
import { defaultDir } from "../params";
import { readManifest } from "../utils/manifest";
import { Apm } from "../utils/Apm";

interface CliCommandOptions extends CliGlobalOptions {
  provider: string;
  tag?: string;
}

export const list: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "list [tag]",
  describe: "List package version tags",

  builder: yargs =>
    yargs
      .positional("tag", {
        description: "tag to print version of",
        type: "string"
      })
      .option("provider", {
        description: `Specify an eth provider: "dappnode" (default), "infura", "localhost:8545"`,
        default: "dappnode",
        type: "string"
      }),

  handler: async (args): Promise<void> => {
    const tagsWithVersions = await listHandler(args);

    if (args.tag) {
      // Output result: "0.1.8"
      const version = tagsWithVersions[args.tag];
      if (!version) {
        throw Error(`Tag ${args.tag} not found`);
      } else {
        console.log(version);
      }
    } else {
      for (const [tag, version] of Object.entries(tagsWithVersions)) {
        // Output result: "latest: 0.1.8"
        console.log(`${tag}: ${version}`);
      }
    }
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function listHandler({
  provider,
  dir = defaultDir
}: CliCommandOptions): Promise<Record<string, string>> {
  const { manifest } = readManifest({ dir });

  return {
    latest: await new Apm(provider).getLatestVersion(manifest.name)
  };
}
