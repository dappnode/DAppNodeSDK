import chalk from "chalk";
import { CommandModule } from "yargs";
import { getInstallDnpLink } from "../../utils/getLinks.js";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../../types.js";
import { UploadTo } from "../../releaseUploader/index.js";
import { defaultVariantsDirName } from "../../params.js";
import { BuildCommandOptions } from "./types.js";
import { buildHandler } from "./handler.js";

export const build: CommandModule<CliGlobalOptions, BuildCommandOptions> = {
  command: "build",
  describe: "Build a new version (only generates the ipfs hash)",

  builder: {
    provider: {
      alias: "p",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    },
    upload_to: {
      alias: "upload-to",
      description: `Specify where to upload the release`,
      choices: ["ipfs", "swarm"] as UploadTo[],
      default: "ipfs" as UploadTo
    },
    timeout: {
      alias: "t",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      default: "60min"
    },
    skip_save: {
      alias: "skip-save",
      description: `For testing only: do not save image to disk`,
      type: "boolean"
    },
    skip_upload: {
      alias: "skip-upload",
      description: `For testing only: do not upload image from disk`,
      type: "boolean"
    },
    all_variants: {
      alias: "all-variants",
      description: `It will use the dappnode_package.json and docker-compose.yml files in the root of the project together with the specific ones defined for each package variant to build all of them`,
      type: "boolean"
    },
    variants_dir_name: {
      alias: "variants-dir-name",
      description: `Name of the directory where the package variants are located (only for packages that support it and combined with either "--all-variants" or "--variants"). By default, it is ${defaultVariantsDirName}`,
      type: "string",
      default: defaultVariantsDirName
    },
    variants: {
      alias: "variant",
      description: `Specify the package variants to build (only for packages that support it). Defined by comma-separated list of variant names. If not specified, all variants will be built. Example: "variant1,variant2"`,
      type: "string"
    }
  },

  handler: async (args): Promise<void> => {
    const buildResults = await buildHandler(args);

    printBuildResults(buildResults, Boolean(args.skipUpload));
  }
};

function printBuildResults(
  buildResults: ListrContextBuildAndPublish,
  skipUpload: boolean
) {
  if (skipUpload) {
    console.log(chalk.green("\nDNP (DAppNode Package) built\n"));
    return;
  }

  for (const [dnpName, { releaseMultiHash }] of Object.entries(buildResults)) {
    if (!releaseMultiHash) continue;

    console.log(`
          ${chalk.green(`Dappnode Package (${dnpName}) built and uploaded`)} 
          DNP name : ${dnpName}
          Release hash : ${releaseMultiHash}
          ${getInstallDnpLink(releaseMultiHash)}
        `);
  }
}
