const path = require("path");
const Listr = require("listr");
// Tasks
const buildAndUpload = require("../tasks/buildAndUpload");
const generatePublishTx = require("../tasks/generatePublishTx");
const createGithubRelease = require("../tasks/createGithubRelease");
// Utils
const getCurrentLocalVersion = require("../utils/versions/getCurrentLocalVersion");
const increaseFromApmVersion = require("../utils/versions/increaseFromApmVersion");
const outputTxData = require("../utils/outputTxData");
const verifyIpfsConnection = require("../utils/verifyIpfsConnection");
const verifyEthConnection = require("../utils/verifyEthConnection");

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
    .option("github_release", {
      description: `Publish the release on the Github repo specified in the manifest. Requires a GITHUB_TOKEN ENV to authenticate`
    })
    .require("type");

exports.handler = async ({
  type,
  provider,
  eth_provider,
  ipfs_provider,
  developer_address,
  github_release,
  timeout
}) => {
  // Parse options
  const ethProvider = provider || eth_provider;
  const ipfsProvider = provider || ipfs_provider;
  const developerAddress = developer_address;
  const userTimeout = timeout;
  const githubRelease = github_release;

  const dir = "./";
  const silent = false;
  const verbose = false;

  await verifyIpfsConnection({ ipfsProvider });
  await verifyEthConnection({ ethProvider });

  const publishTasks = new Listr([
    /**
     * 1. Fetch current version from APM
     */
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
        ctx.nextVersion = nextVersion;
        ctx.buildDir = path.join(dir, `build_${nextVersion}`);
      }
    },
    /**
     * 2. Build and upload
     */
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
     * 3. Generate transaction
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
    },
    /**
     * 4. Create github release
     * [ONLY] add the Release task if requested
     */
    {
      title: "Release on github",
      enabled: () => githubRelease,
      task: ctx =>
        createGithubRelease({
          dir,
          buildDir: ctx.buildDir,
          verbose,
          silent
        })
    }
  ]);

  const { txData, buildDir } = await publishTasks.run();

  outputTxData({
    txData,
    toConsole: !silent,
    toFile: path.join(buildDir, "deploy.txt")
  });
};
