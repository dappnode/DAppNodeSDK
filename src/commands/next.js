const getNextVersionFromApm = require("../utils/versions/getNextVersionFromApm");
const verifyEthConnection = require("../utils/verifyEthConnection");

exports.command = "next [type]";

exports.describe = "Compute the next release version from local";

exports.builder = yargs =>
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

exports.handler = async ({ type, provider, dir }) => {
  const ethProvider = provider;

  await verifyEthConnection({ ethProvider });

  // Execute command
  const nextVersion = await getNextVersionFromApm({
    type,
    ethProvider,
    dir
  });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
