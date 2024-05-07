import path from "path";
import Listr from "listr";
import chalk from "chalk";
import { CommandModule } from "yargs";
// Tasks
import { buildAndUpload } from "../../tasks/buildAndUpload/index.js";
import { generatePublishTx } from "../../tasks/generatePublishTx.js";
import { createGithubRelease } from "../../tasks/createGithubRelease.js";
// Utils
import { getCurrentLocalVersion } from "../../utils/versions/getCurrentLocalVersion.js";
import { increaseFromApmVersion } from "../../utils/versions/increaseFromApmVersion.js";
import { verifyEthConnection } from "../../utils/verifyEthConnection.js";
import { getInstallDnpLink, getPublishTxLink } from "../../utils/getLinks.js";
import { defaultComposeFileName, defaultDir, YargsError } from "../../params.js";
import {
  CliGlobalOptions,
  ListrContextBuildAndPublish,
  ReleaseType,
  releaseTypes
} from "../../types.js";
import { printObject } from "../../utils/print.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { VerbosityOptions } from "../build/types.js";

const typesList = releaseTypes.join(" | ");

interface CliCommandOptions extends CliGlobalOptions {
  type?: string;
  provider?: string;
  eth_provider: string;
  content_provider: string;
  upload_to: UploadTo;
  developer_address?: string;
  timeout?: string;
  github_release?: boolean;
  dappnode_team_preset?: boolean;
  require_git_data?: boolean;
  delete_old_pins?: boolean;
}

export const publish: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "publish [type]",
  describe:
    "Publish a new version of the package in an Aragon Package Manager Repository",

  builder: {
    type: {
      description: `Semver update type. Can also be provided with env RELEASE_TYPE=[type] or via TRAVIS_TAG=release (patch), TRAVIS_TAG=release/[type]`,
      choices: releaseTypes,
      type: "string"
    },
    provider: {
      alias: "p",
      description: `Specify a provider (overwrittes content_provider and eth_provider): "dappnode" (default), "infura", "http://localhost:8545"`,
      // Must NOT add a default here, so options can overwrite each other in the handler
      // default: "dappnode",
      type: "string"
    },
    eth_provider: {
      description: `Specify an eth provider: "dappnode" (default), "infura", "localhost:8545"`,
      default: "dappnode",
      type: "string"
    },
    content_provider: {
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "http://localhost:5001"`,
      default: "dappnode",
      type: "string"
    },
    upload_to: {
      description: `Specify where to upload the release`,
      choices: ["ipfs", "swarm"],
      default: "ipfs" as UploadTo
    },
    developer_address: {
      alias: "a",
      description: `If there is no existing repo for this DNP the publish command needs a developer address. If it is not provided as an option a prompt will request it`,
      type: "string"
    },
    timeout: {
      alias: "t",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      type: "string"
    },
    github_release: {
      description: `Publish the release on the Github repo specified in the manifest. Requires a GITHUB_TOKEN ENV to authenticate`,
      type: "boolean"
    },
    dappnode_team_preset: {
      description: `Specific set of options used for internal DAppNode releases. Caution: options may change without notice.`,
      type: "boolean"
    }
  },

  handler: async args => {
    const publishedData = await publishHandler(
      args
    );

    Object.entries(publishedData).map(([dnpName, publishedItem]) =>
      printPublishedData({ dnpName, publishedItem })
    );
  }

};

/**
 * Common handler for CLI and programatic usage
 */
export async function publishHandler({
  type,
  provider,
  eth_provider,
  content_provider,
  developer_address: developerAddress = process.env.DEVELOPER_ADDRESS,
  timeout: userTimeout,
  upload_to: uploadTo,
  github_release: githubRelease,
  dappnode_team_preset: dappnode_team_preset,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: CliCommandOptions): Promise<ListrContextBuildAndPublish> {
  let ethProvider = provider || eth_provider;
  let contentProvider = provider || content_provider;

  const isCi = process.env.CI;

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  /**
   * Specific set of options used for internal DAppNode releases.
   * Caution: options may change without notice.
   */
  if (dappnode_team_preset) {
    if (isCi) {
      contentProvider = "https://api.ipfs.dappnode.io";
      uploadTo = "ipfs";
      verbose = true;
    }
    ethProvider = "infura";
    githubRelease = true;
  }

  await verifyEthConnection(ethProvider);

  const publishTasks = new Listr(
    [
      {
        title: "Fetch current version from APM",
        task: async (ctx, task) => {
          let nextVersion;
          try {
            nextVersion = await increaseFromApmVersion({
              type: parseReleaseType({ type }),
              ethProvider,
              dir,
              composeFileName
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
      {
        title: "Build and upload",
        task: () =>
          new Listr(
            buildAndUpload({
              dir,
              composeFileName,
              contentProvider,
              uploadTo,
              userTimeout,
              requireGitData,
              deleteOldPins,
              // TODO
            }),
            verbosityOptions
          )
      },
      {
        title: "Generate transaction",
        task: ctx =>
          generatePublishTx({
            dir,
            compose_file_name: composeFileName,
            releaseMultiHash: ctx.releaseMultiHash,
            developerAddress,
            ethProvider,
            verbose,
            silent
          })
      },
      {
        title: "Release on github",
        enabled: () => !!githubRelease, // Only create release if requested
        task: ctx =>
          createGithubRelease({
            dir,
            compose_file_name: composeFileName,
            buildDir: ctx.buildDir,
            releaseMultiHash: ctx.releaseMultiHash,
            verbose,
            silent
          })
      }
    ],
    verbosityOptions
  );

  return await publishTasks.run();
}

function printPublishedData({ dnpName, publishedItem }: { dnpName: string, publishedItem: ListrContextBuildAndPublish[string] }) {
  const { releaseMultiHash, nextVersion, txData, variant } = publishedItem;

  const txDataToPrint = {
    To: txData.to,
    Value: txData.value,
    Data: txData.data,
    Gas: txData.gasLimit
  };

  console.log(`
${chalk.green(`Dappnode Package (${variant}) published (version ${nextVersion})`)} 
DNP name : ${dnpName}
Release hash : ${releaseMultiHash}
${getInstallDnpLink(releaseMultiHash)}

${"You must execute this transaction in mainnet to publish a new version of this DNP."}

${chalk.gray(
    printObject(txDataToPrint, (key, value) => `  ${key.padEnd(5)} : ${value}`)
  )}

${"You can also execute this transaction with Metamask by following this pre-filled link"}

${chalk.cyan(getPublishTxLink(txData))}
  `);
}

function parseReleaseType({ type }: { type?: string }): ReleaseType {

  const tag = process.env.TRAVIS_TAG || process.env.GITHUB_REF;
  const typeFromEnv = process.env.RELEASE_TYPE;

  /**
   * Custom options to pass the type argument
   */
  if (!type) {
    if (typeFromEnv)
      type = typeFromEnv;

    if (tag?.includes("release"))
      type = parseReleaseTypeFromTag(tag);
  }


  if (!type && typeFromEnv) {
    type = typeFromEnv as ReleaseType;
  }
  if (!type && tag?.includes("release")) {
    type = parseReleaseTypeFromTag(tag);
  }

  validateReleaseType(type);

  return type as ReleaseType;
}

function parseReleaseTypeFromTag(tag: string): ReleaseType {
  return (tag.split("release/")[1] || "patch") as ReleaseType;
}

/**
* Make sure the release type exists and is correct
*/
function validateReleaseType(type?: string) {
  if (!type)
    throw new YargsError(`Missing required argument [type]: ${typesList}`);

  if (!releaseTypes.includes(type as ReleaseType))
    throw new YargsError(
      `Invalid release type "${type}", must be: ${typesList}`
    );
}