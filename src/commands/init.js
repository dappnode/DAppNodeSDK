const initializeDnp = require("../methods/initializeDnp");

/**
 * INIT
 *
 * Initialize the repository
 */

exports.command = "init";

exports.describe = "Initialize a new DAppNodePackage (DNP) repository";

exports.builder = yargs =>
  yargs.option("y", {
    alias: "yes",
    description:
      "Answer yes or the default option to all initialization questions"
  });

exports.handler = async ({ yes: useDefaults, dir }) => {
  await initializeDnp({ dir, useDefaults });
};
