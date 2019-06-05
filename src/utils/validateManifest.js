const chalk = require("chalk");
const manifestUtils = require("@dappnode/dnp-manifest");

function validateManifest(manifest) {
  const { valid, errors } = manifestUtils.validateManifest(manifest);
  if (valid) return;

  // If not valid, print errors and stop execution

  console.error(`

  ${chalk.red("Invalid manifest:")}
${errors.map(msg => `  - ${msg}`).join("\n")}

`);

  process.exit(1);
}

module.exports = validateManifest;
