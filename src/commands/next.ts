import { CommandModule } from "yargs";
import { getNextVersionFromApm } from "../utils/versions/getNextVersionFromApm";
import { verifyEthConnection } from "../utils/verifyEthConnection";
import { CliGlobalOptions, ReleaseType } from "../types";
import { defaultDir } from "../params";

interface CliCommandOptions extends CliGlobalOptions {
  type: string;
  provider: string;
}

export const next: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "next [type]",
  describe: "Compute the next release version from local",

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

  await verifyEthConnection(ethProvider);

  // Execute command
  return await getNextVersionFromApm({
    type: type as ReleaseType,
    ethProvider,
    dir
  });
}
