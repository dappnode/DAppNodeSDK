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
const { throwYargsErr } = require("../utils/yargsErr");

const validTypes = ["major", "minor", "patch"];
const typesList = validTypes.join(" | ");

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
      description: `Semver update type: [ ${typesList} ]. Can also be provided with env RELEASE_TYPE=[type] or via TRAVIS_TAG=release (patch), TRAVIS_TAG=release/[type]`,
      choices: validTypes,
      coerce: (...args) => {
        console.log({ args });
      }
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
    .option("create_next_branch", {
      description: `Create the next release branch on the DNP's Github repo. Requires a GITHUB_TOKEN ENV to authenticate`
    })
    .option("dappnode_team_preset", {
      description: `Specific set of options used for internal DAppNode releases. Caution: options may change without notice.`
    });

exports.handler = async ({
  type,
  provider,
  eth_provider,
  ipfs_provider,
  developer_address,
  timeout,
  github_release,
  create_next_branch,
  dappnode_team_preset,
  // Global options
  dir,
  silent,
  verbose
}) => {
  // Parse options
  let ethProvider = provider || eth_provider;
  let ipfsProvider = provider || ipfs_provider;
  let developerAddress = developer_address || process.env.DEVELOPER_ADDRESS;
  let userTimeout = timeout;
  let githubRelease = github_release;
  let createNextGithubBranch = create_next_branch;

  const { TRAVIS, TRAVIS_TAG, RELEASE_TYPE } = process.env;

  /**
   * Specific set of options used for internal DAppNode releases.
   * Caution: options may change without notice.
   */
  if (dappnode_team_preset) {
    if (TRAVIS) {
      ethProvider = "infura";
      ipfsProvider = "infura";
    }
    githubRelease = true;
    createNextGithubBranch = true;
    // Compute the type if it's not specified
  }

  /**
   * Custom options to pass the type argument
   */
  if (!type && RELEASE_TYPE) type = RELEASE_TYPE;
  if (!type && TRAVIS_TAG.startsWith("release"))
    type = TRAVIS_TAG.split("release/")[1] || "patch";

  /**
   * Make sure the release type exists and is correct
   */
  if (!type) throwYargsErr(`Missing required argument [type]: ${typesList}`);
  if (!validTypes.includes(type))
    throwYargsErr(`Invalid release type "${type}", must be: ${typesList}`);

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
          createNextGithubBranch,
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
