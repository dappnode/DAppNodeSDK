import chalk from "chalk";
import { CommandModule } from "yargs";
import { getInstallDnpLink, getPublishTxLink } from "../../utils/getLinks.js";
import {
  CliGlobalOptions,
  ListrContextPublish,
  releaseTypes
} from "../../types.js";
import { printObject } from "../../utils/print.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { publishHandler } from "./handler.js";
import { PublishCommandOptions } from "./types.js";

export const publish: CommandModule<CliGlobalOptions, PublishCommandOptions> = {
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
      alias: "eth-provider",
      description: `Specify an eth provider: "dappnode" (default), "infura", "localhost:8545"`,
      default: "dappnode",
      type: "string"
    },
    content_provider: {
      alias: "content-provider",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "http://localhost:5001"`,
      default: "dappnode",
      type: "string"
    },
    upload_to: {
      alias: "upload-to",
      description: `Specify where to upload the release`,
      choices: ["ipfs", "swarm"],
      default: "ipfs" as UploadTo
    },
    developer_address: {
      alias: ["a", "developer-address"],
      description: `If there is no existing repo for this DNP the publish command needs a developer address. If it is not provided as an option a prompt will request it`,
      type: "string"
    },
    timeout: {
      alias: "t",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      type: "string"
    },
    github_release: {
      alias: "github-release",
      description: `Publish the release on the Github repo specified in the manifest. Requires a GITHUB_TOKEN ENV to authenticate`,
      type: "boolean"
    },
    dappnode_team_preset: {
      alias: "dappnode-team-preset",
      description: `Specific set of options used for internal DAppNode releases. Caution: options may change without notice.`,
      type: "boolean"
    }
  },

  handler: async args => {
    const publishedData = await publishHandler(args);

    Object.entries(publishedData).map(([dnpName, publishedItem]) =>
      printPublishResults({ dnpName, publishedItem })
    );
  }
};

function printPublishResults({
  dnpName,
  publishedItem
}: {
  dnpName: string;
  publishedItem: ListrContextPublish[string];
}) {
  const { releaseMultiHash, nextVersion, txData, variant } = publishedItem;

  if (!txData || !releaseMultiHash) {
    console.log(`
    ${chalk.red(
      `Could not generate tx to publish Dappnode Package (${variant})`
    )}
    `);
    return;
  }

  const txDataToPrint = {
    To: txData.to,
    Value: txData.value,
    Data: txData.data,
    Gas: txData.gasLimit
  };

  console.log(`
${chalk.green(`Dappnode Package (${variant}) is ready to be published`)} 
DNP name : ${dnpName}
Version: ${nextVersion}
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
