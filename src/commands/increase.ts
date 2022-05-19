import { CommandModule } from "yargs";
import semver, { ReleaseType } from "semver";
import { CliGlobalOptions } from "../types";
import { defaultComposeFileName, defaultDir } from "../params";
import { readManifest, writeManifest } from "../utils/manifest";
import {
  readCompose,
  updateComposeImageTags,
  writeCompose
} from "../utils/compose";

export const command = "increase [type]";

export const describe = "Increases the version defined in the manifest";

interface CliCommandOptions extends CliGlobalOptions {
  type: string;
}

export const increase: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "increase [type]",
  describe: "Increases the version defined in the manifest",

  builder: yargs =>
    yargs.positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"],
      type: "string",
      demandOption: true
    }),

  handler: async (args): Promise<void> => {
    const nextVersion = await increaseHandler(args);
    // Output result: "0.1.8"
    console.log(nextVersion);
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function increaseHandler({
  type,
  dir = defaultDir,
  compose_file_name = defaultComposeFileName
}: CliCommandOptions): Promise<string> {
  const composeFileName = compose_file_name;

  // Load manifest
  const { manifest, format } = readManifest({ dir });

  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type as ReleaseType);
  if (!nextVersion) throw Error(`Invalid increase: ${currentVersion} ${type}`);
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest(manifest, format, { dir });
  const { name, version } = manifest;
  const compose = readCompose({ dir, composeFileName });
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
