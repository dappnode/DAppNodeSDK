import { BuilderCallback } from "yargs";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { CliGlobalOptions, ReleaseType } from "../types";

export const command = "increase [type]";

export const describe = "Increases the version defined in the manifest";

interface CliCommandOptions {
  type: ReleaseType;
}

export const builder: BuilderCallback<CliCommandOptions, unknown> = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"],
      type: "string"
    })
    .require("type");

export const handler = async ({
  type,
  dir
}: CliCommandOptions & CliGlobalOptions): Promise<void> => {
  // Execute command
  const nextVersion = await increaseFromLocalVersion({ type, dir });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
