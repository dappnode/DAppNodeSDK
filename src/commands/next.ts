import { CommandModule } from "yargs";
import semver from "semver";
import { CliGlobalOptions, ReleaseType } from "../types";
import { defaultDir } from "../params";
import { getPM, verifyEthConnection } from "../providers/pm";
import { readManifest } from "../utils/manifest";

interface CliCommandOptions extends CliGlobalOptions {
  type: string;
  provider: string;
}

export const next: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "next [type]",
  describe: "Compute the next release version from published repo",

  builder: yargs =>
    yargs
      .positional("type", {
        description: "Semver update type: [ major | minor | patch ]",
        choices: ["major", "minor", "patch"],
        type: "string"
      })
      .option("provider", {
        alias: "p",
        description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
        default: "dappnode",
        type: "string"
      })
      .require("type"),

  handler: async (args): Promise<void> => {
    const nextVersion = await nextHandler(args);
    // Output result: "0.1.8"
    console.log(nextVersion);
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function nextHandler({
  type,
  provider,
  dir = defaultDir
}: CliCommandOptions): Promise<string> {
  const ethProvider = provider;

  const pm = getPM(ethProvider);
  await verifyEthConnection(pm);

  const { manifest } = readManifest({ dir });
  const latestVersion = await pm.getLatestVersion(manifest.name);

  const nextVersion = semver.inc(latestVersion, type as ReleaseType);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  // Execute command
  return nextVersion;
}
