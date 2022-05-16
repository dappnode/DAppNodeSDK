import { CommandModule } from "yargs";
import semver from "semver";
import { CliGlobalOptions } from "../types";
import { defaultComposeFileName, defaultDir } from "../params";
import { readManifest, writeManifest } from "../utils/manifest";
import {
  readCompose,
  updateComposeImageTags,
  writeCompose
} from "../utils/compose";

interface CliCommandOptions extends CliGlobalOptions {
  type: string;
}

export const version: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "version [type]",
  describe: "Bump a package version",

  builder: yargs =>
    yargs.positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"],
      type: "string",
      demandOption: true
    }),

  handler: async (args): Promise<void> => {
    const nextVersion = await versionHandler(args);
    // Output result: "0.1.8"
    console.log(nextVersion);
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function versionHandler({
  type,
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName
}: CliCommandOptions): Promise<string> {
  // Load manifest
  const { manifest, format } = readManifest({ dir });

  // If `type` is a valid `semver.ReleaseType` the version will be bumped, else return null
  const nextVersion =
    semver.inc(manifest.version, type as semver.ReleaseType) || type;
  if (!semver.valid(nextVersion)) {
    throw Error(`Invalid semver bump or version: ${type}`);
  }

  // Mofidy and write the manifest and docker-compose
  manifest.version = nextVersion;
  writeManifest(manifest, format, { dir });

  const { name, version } = manifest;
  const compose = readCompose({ dir, composeFileName });
  const newCompose = updateComposeImageTags(compose, { name, version });
  writeCompose(newCompose, { dir, composeFileName });

  return nextVersion;
}
