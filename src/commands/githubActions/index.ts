import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../types";
import { gaBuild } from "./build";
import { gaBumpUpstream } from "./bumpUpstream";

export const githubActions: CommandModule<
  CliGlobalOptions,
  CliGlobalOptions
> = {
  command: "github-action",
  describe:
    "Github actions tooling to be run in CI. Uses a specific set of options for internal DAppNode use. Caution: options may change without notice.",
  builder: yargs =>
    yargs.command(gaBuild).command(gaBumpUpstream).demandCommand(1),
  handler: async (): Promise<void> => {
    throw Error("Requires 1 command");
  }
};
