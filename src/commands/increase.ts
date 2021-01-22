import { CommandModule } from "yargs";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { CliGlobalOptions, ReleaseType } from "../types";
import { defaultComposeFileName, defaultDir } from "../params";

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
  return await increaseFromLocalVersion({
    type: type as ReleaseType,
    dir,
    compose_file_name
  });
}
