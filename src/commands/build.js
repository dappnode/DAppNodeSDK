const path = require("path");
const chalk = require("chalk");
// Tasks
const buildAndUpload = require("../tasks/buildAndUpload");
// Utils
const getCurrentLocalVersion = require("../utils/versions/getCurrentLocalVersion");
const verifyIpfsConnection = require("../utils/verifyIpfsConnection");
const getLinks = require("../utils/getLinks");

/**
 * INIT
 *
 * Initialize the repository
 */

exports.command = "build";

exports.describe = "Build a new version (only generates the ipfs hash)";

exports.builder = yargs =>
  yargs
    .option("p", {
      alias: "provider",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    })
    .option("t", {
      alias: "timeout",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      default: "15min"
    });

exports.handler = async ({
  provider,
  timeout,
  // Global options
  dir,
  silent,
  verbose
}) => {
  // Parse options
  const ipfsProvider = provider;
  const userTimeout = timeout;
  const nextVersion = getCurrentLocalVersion({ dir });
  const buildDir = path.join(dir, `build_${nextVersion}`);

  await verifyIpfsConnection({ ipfsProvider });

  const buildAndUploadTasks = buildAndUpload({
    dir,
    buildDir,
    ipfsProvider,
    userTimeout,
    verbose,
    silent
  });

  const { manifestIpfsPath } = await buildAndUploadTasks.run();

  console.log(`
  ${chalk.green("DNP (DAppNode Package) built and uploaded")} 
  Manifest hash : ${manifestIpfsPath}
  Install link  : ${getLinks.installDnp({ manifestIpfsPath })}
`);
};
