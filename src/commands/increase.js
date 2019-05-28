const increaseFromLocalVersion = require("../utils/versions/increaseFromLocalVersion");

exports.command = "increase [type]";

exports.describe = "Increases the version defined in the manifest";

exports.builder = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"]
    })
    .require("type");

exports.handler = async ({ type }) => {
  // Parse options
  const dir = "./";

  // Execute command
  const nextVersion = await increaseFromLocalVersion({ type, dir });
  // Output result: "0.1.8"
  console.log(nextVersion);
};
