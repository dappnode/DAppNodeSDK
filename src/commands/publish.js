const path = require("path");
const Listr = require("listr");
const chalk = require("chalk");
// Tasks
const buildAndUpload = require("../tasks/buildAndUpload");
const generatePublishTx = require("../tasks/generatePublishTx");
const createGithubRelease = require("../tasks/createGithubRelease");
// Utils
const getCurrentLocalVersion = require("../utils/versions/getCurrentLocalVersion");
const increaseFromApmVersion = require("../utils/versions/increaseFromApmVersion");
const verifyIpfsConnection = require("../utils/verifyIpfsConnection");
const verifyEthConnection = require("../utils/verifyEthConnection");
const getLinks = require("../utils/getLinks");
const { YargsError } = require("../params");

const validTypes = ["major", "minor", "patch"];
const typesList = validTypes.join(" | ");

/**
 * Publish
 *
 * Publish a new version
 */

exports.command = "publish [type]";

exports.describe =
  "Publish a new version of the package in an Aragon Package Manager Repository";

exports.builder = yargs =>
  yargs
    .positional("type", {
      description: `Semver update type. Can also be provided with env RELEASE_TYPE=[type] or via TRAVIS_TAG=release (patch), TRAVIS_TAG=release/[type]`,
      choices: validTypes,
      type: "string"
    })
    .option("p", {
      alias: "provider",
      description: `Specify a provider (overwrittes ipfs_provider and eth_provider): "dappnode" (default), "infura", "http://localhost:8545"`,
      default: "dappnode",
      type: "string"
    })
    .option("eth_provider", {
      description: `Specify an eth provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode",
      type: "string"
    })
    .option("ipfs_provider", {
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "http://localhost:8545"`,
      default: "dappnode",
      type: "string"
    })
    .option("a", {
      alias: "developer_address",
      description: `If there is no existing repo for this DNP the publish command needs a developer address. If it is not provided as an option a prompt will request it`,
      type: "string"
    })
    .option("t", {
      alias: "timeout",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      default: "15min",
      type: "string"
    })
    .option("r", {
      alias: "release_type",
      description: `Specify release type`,
      choices: ["manifest", "directory"],
      default: "manifest"
    })
    .option("github_release", {
      description: `Publish the release on the Github repo specified in the manifest. Requires a GITHUB_TOKEN ENV to authenticate`,
      type: "boolean"
    })
    .option("create_next_branch", {
      description: `Create the next release branch on the DNP's Github repo. Requires a GITHUB_TOKEN ENV to authenticate`,
      type: "boolean"
    })
    .option("dappnode_team_preset", {
      description: `Specific set of options used for internal DAppNode releases. Caution: options may change without notice.`,
      type: "boolean"
    });

// Do not add `.require("type")`, it is verified below

exports.handler = async ({
  type,
  provider,
  eth_provider,
  ipfs_provider,
  developer_address,
  timeout,
  release_type,
  upload_to,
  github_release,
  create_next_branch,
  dappnode_team_preset,
  // Global options
  dir,
  silent,
  verbose
}) => {
  // Parse optionsalias: "release",
  let ethProvider = provider || eth_provider;
  let ipfsProvider = provider || ipfs_provider;
  let swarmProvider = provider;
  let githubRelease = github_release;
  let createNextGithubBranch = create_next_branch;
  const developerAddress = developer_address || process.env.DEVELOPER_ADDRESS;
  const userTimeout = timeout;
  const uploadToSwarm = upload_to === "swarm";
  const isDirectoryRelease = uploadToSwarm || release_type === "directory";

  const { TRAVIS, TRAVIS_TAG, RELEASE_TYPE } = process.env;

  /**
   * Specific set of options used for internal DAppNode releases.
   * Caution: options may change without notice.
   */
  if (dappnode_team_preset) {
    if (TRAVIS) {
      ethProvider = "infura";
      ipfsProvider = "http://ipfs.dappnode.io";
      // Activate verbose to see logs easier afterwards
      verbose = true;
    }
    githubRelease = true;
    createNextGithubBranch = true;
  }

  /**
   * Custom options to pass the type argument
   */
  if (!type && RELEASE_TYPE) type = RELEASE_TYPE;
  if (!type && TRAVIS_TAG && TRAVIS_TAG.startsWith("release"))
    type = TRAVIS_TAG.split("release/")[1] || "patch";

  /**
   * Make sure the release type exists and is correct
   */
  if (!type)
    throw new YargsError(`Missing required argument [type]: ${typesList}`);
  if (!validTypes.includes(type))
    throw new YargsError(
      `Invalid release type "${type}", must be: ${typesList}`
    );

  await verifyIpfsConnection({ ipfsProvider });
  await verifyEthConnection({ ethProvider });

  const publishTasks = new Listr(
    [
      /**
       * 1. Fetch current version from APM
       */
      {
        title: "Fetch current version from APM",
        task: async (ctx, task) => {
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
          task.title = task.title + ` (next version: ${nextVersion})`;
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
            swarmProvider,
            userTimeout,
            isDirectoryRelease,
            uploadToSwarm,
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
       *   releaseMultiHash
       * }
       */
      {
        title: "Generate transaction",
        task: ctx =>
          generatePublishTx({
            releaseMultiHash: ctx.releaseMultiHash,
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
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );

  const tasksFinalCtx = await publishTasks.run();
  const { txData, nextVersion, releaseMultiHash } = tasksFinalCtx;

  if (!silent) {
    const txDataToPrint = {
      To: txData.to,
      Value: txData.value,
      Data: txData.data,
      Gas: txData.gasLimit
    };

    console.log(`
  ${chalk.green(`DNP (DAppNode Package) published (version ${nextVersion})`)} 
  ${isDirectoryRelease ? "Release" : "Manifest"} hash : ${releaseMultiHash}
  Install link : ${getLinks.installDnp({ releaseMultiHash })}

  ${"You must execute this transaction in mainnet to publish a new version of this DNP."}
  
${chalk.gray(
  Object.keys(txDataToPrint)
    .map(key => `  ${key.padEnd(5)} : ${txDataToPrint[key]}`)
    .join("\n")
)}

  ${"You can also execute this transaction with Metamask by following this pre-filled link"}
  
  ${chalk.cyan(getLinks.publishTx({ txData }))}
`);
  }
};
