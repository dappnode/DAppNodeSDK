import { BuilderCallback } from "yargs";
import { getNextVersionFromApm } from "../utils/versions/getNextVersionFromApm";
import { verifyEthConnection } from "../utils/verifyEthConnection";
import { CliGlobalOptions, ReleaseType } from "../types";

export const command = "next [type]";

export const describe = "Compute the next release version from local";

export const builder: BuilderCallback<any, any> = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"],
      type: "string"
    })
    .option("p", {
      alias: "provider",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode",
      type: "string"
    })
    .require("type");

interface CliCommandOptions {
  type: ReleaseType;
  provider: string;
}

export const handler = async ({
  type,
  provider,
  dir
}: CliCommandOptions & CliGlobalOptions) => {
  const ethProvider = provider;

  await verifyEthConnection(ethProvider);

  // Execute command
  const nextVersion = await getNextVersionFromApm({
    type,
    ethProvider,
    dir
  });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
