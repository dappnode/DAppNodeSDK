import { CommandModule } from "yargs";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { CliGlobalOptions, ReleaseType } from "../types";

export const command = "increase [type]";

export const describe = "Increases the version defined in the manifest";

interface CliCommandOptions extends CliGlobalOptions {
  type: string;
}

export const increase: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "increase [type]",
  describe: "Increases the version defined in the manifest",

  builder: yargs =>
    yargs
      .positional("type", {
        description: "Semver update type: [ major | minor | patch ]",
        choices: ["major", "minor", "patch"],
        type: "string"
      })
      .require("type"),

  handler: async ({
    type,
    dir
  }: CliCommandOptions & CliGlobalOptions): Promise<void> => {
    // Execute command
    const nextVersion = await increaseFromLocalVersion({
      type: type as ReleaseType,
      dir
    });
    // Output result: "0.1.8"
    console.log(nextVersion);
  }
};
