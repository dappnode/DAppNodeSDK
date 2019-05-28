const getNextVersionFromApm = require("../utils/versions/getNextVersionFromApm");

exports.command = "next [type]";

exports.describe = "Compute the next release version from local";

exports.builder = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"]
    })
    .option("p", {
      alias: "provider",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    })
    .require("type");

exports.handler = async ({ type, provider }) => {
  // Parse options
  const dir = "./";

  // Execute command
  const nextVersion = await getNextVersionFromApm({
    type,
    ethProvider: provider,
    dir
  });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
