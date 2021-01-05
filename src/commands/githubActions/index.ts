import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../types";
import { buildOnPr } from "./build-on-pr";
import { unpinOnRefDelete } from "./unpin-on-ref-delete";

export const githubActions: CommandModule<
  CliGlobalOptions,
  CliGlobalOptions
> = {
  command: "github-action",
  describe: "Github action tooling, should be run only in CI",
  builder: yargs =>
    yargs.command(buildOnPr).command(unpinOnRefDelete).demandCommand(1),
  handler: async (): Promise<void> => {
    throw Error("Requires 1 command");
  }
};
