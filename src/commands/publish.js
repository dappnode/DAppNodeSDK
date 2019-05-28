const path = require("path");
const Listr = require("listr");
const buildAndUpload = require("../tasks/buildAndUpload");
const generatePublishTx = require("../tasks/generatePublishTx");
const getCurrentLocalVersion = require("../utils/versions/getCurrentLocalVersion");
const increaseFromApmVersion = require("../utils/versions/increaseFromApmVersion");
const outputTxData = require("../utils/outputTxData");

/**
 * INIT
 *
 * Initialize the repository
 */

exports.command = "publish [type]";

exports.describe =
  "Publish a new version of the package in an Aragon Package Manager Repository";

exports.builder = yargs =>
  yargs
    .positional("type", {
      description: "Semver update type: [ major | minor | patch ]",
      choices: ["major", "minor", "patch"]
    })
    .option("p", {
      alias: "provider",
      description: `Specify a provider (overwrittes ipfs_provider and eth_provider): "dappnode" (default), "infura", "http://localhost:8545"`,
      default: "dappnode"
    })
    .option("eth_provider", {
      description: `Specify an eth provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    })
    .option("ipfs_provider", {
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "http://localhost:8545"`,
      default: "dappnode"
    })
    .option("a", {
      alias: "developer_address",
      description: `If there is no existing repo for this DNP the publish command needs a developer address. If it is not provided as an option a prompt will request it`
    })
    .option("t", {
      alias: "timeout",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      default: "15min"
    })
    .require("type");

exports.handler = async ({
  type,
  provider,
  eth_provider,
  ipfs_provider,
  developer_address,
  timeout
}) => {
  // Parse options
  const ethProvider = provider || eth_provider;
  const ipfsProvider = provider || ipfs_provider;
  const developerAddress = developer_address;
  const userTimeout = timeout;

  const dir = "./";
  const silent = false;
  const verbose = false;

  const publishTasks = new Listr([
    {
      title: "Fetch current version from APM",
      task: async ctx => {
        let nextVersion;
        try {
          nextVersion = await increaseFromApmVersion({
            type,
            ethProvider,
            dir
          });
        } catch (e) {
          if (e.message.includes("NOREPO"))
            nextVersion = getCurrentLocalVersion({ dir });
          else throw e;
        }
        ctx.buildDir = path.join(dir, `build_${nextVersion}`);
      }
    },
    {
      title: "Build and upload",
      task: ctx =>
        buildAndUpload({
          dir,
          buildDir: ctx.buildDir,
          ipfsProvider,
          userTimeout,
          verbose,
          silent
        })
    },
    /**
     * Appends ctx.txData = {
     *   to: repo or registry address
     *   value: 0,
     *   data: newVersionCall.encodeABI(),
     *   gasLimit: 300000,
     *   ensName,
     *   currentVersion,
     *   manifestIpfsPath
     * }
     */
    {
      title: "Generate transaction",
      task: ctx =>
        generatePublishTx({
          manifestIpfsPath: ctx.manifestIpfsPath,
          dir,
          developerAddress,
          ethProvider,
          verbose,
          silent
        })
    }
  ]);

  const { txData, buildDir } = await publishTasks.run();

  outputTxData({
    txData,
    toConsole: !silent,
    toFile: `${buildDir}/deploy.txt`
  });
};
