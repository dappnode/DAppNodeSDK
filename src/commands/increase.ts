import { BuilderCallback } from "yargs";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { CliGlobalOptions, ReleaseType } from "../types";

export const command = "increase [type]";

export const describe = "Increases the version defined in the manifest";

export const builder: BuilderCallback<any, any> = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"],
      type: "string"
    })
    .require("type");

interface CliCommandOptions {
  type: ReleaseType;
}

export const handler = async ({
  type,
  dir
}: CliCommandOptions & CliGlobalOptions) => {
  // Execute command
  const nextVersion = await increaseFromLocalVersion({ type, dir });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
