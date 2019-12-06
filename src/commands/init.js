const initializeDnp = require("../methods/initializeDnp");

/**
 * INIT
 *
 * Initialize the repository
 */

exports.command = "init";

exports.describe = "Initialize a new DAppNodePackage (DNP) repository";

exports.builder = yargs =>
  yargs
    .option("y", {
      alias: "yes",
      description:
        "Answer yes or the default option to all initialization questions",
      type: "boolean"
    })
    .option("f", {
      alias: "force",
      description: "Overwrite previous project if necessary",
      type: "boolean"
    });

exports.handler = async ({ yes: useDefaults, force, dir }) =>
  await initializeDnp({ dir, useDefaults, force });
