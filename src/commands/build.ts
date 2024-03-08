import fs from "fs";
import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import Listr from "listr";
// Tasks
import { BuildAndUploadOptions, buildAndUpload } from "../tasks/buildAndUpload.js";
// Utils
import { getCurrentLocalVersion } from "../utils/versions/getCurrentLocalVersion.js";
import { getInstallDnpLink } from "../utils/getLinks.js";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types.js";
import { UploadTo } from "../releaseUploader/index.js";
import { defaultComposeFileName, defaultDir, defaultVariantsDir } from "../params.js";

interface CliCommandOptions extends CliGlobalOptions {
  provider: string;
  upload_to: UploadTo;
  timeout?: string;
  skip_save?: boolean;
  skip_upload?: boolean;
  require_git_data?: boolean;
  delete_old_pins?: boolean;
  template?: boolean;
  variantsDir?: string;
  variants?: string;
}

export const build: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "build",
  describe: "Build a new version (only generates the ipfs hash)",

  builder: {
    provider: {
      alias: "p",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    },
    upload_to: {
      alias: "upload_to",
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
      description: `For testing only: do not save image to disk`,
      type: "boolean"
    },
    skip_upload: {
      description: `For testing only: do not upload image from disk`,
      type: "boolean"
    },
    template: {
      description: `Enables template mode. It will use the dappnode_package.json and docker-compose.yml files in the root of the project together with the specific ones defined for each package variant`,
      type: "boolean"
    },
    variantsDir: {
      description: `Path to the directory where the package variants are located`,
      type: "string",
      default: defaultVariantsDir
    },
    variants: {
      description: `Specify the package variants to build (only in template mode). Defined by comma-separated list of variant names. If not specified, all variants will be built. Example: "variant1,variant2"`,
      type: "string"
    }
  },

  handler: async (args): Promise<void> => {
    //const { releaseMultiHash } = await buildHandler(args);
    const buildResults = await buildHandler(args);

    if (args.skipUpload) {
      return console.log(chalk.green("\nDNP (DAppNode Package) built\n"));
    }

    for (const result of buildResults) {
      console.log(`
      ${chalk.green("DNP (DAppNode Package) built and uploaded")} 
      DNP name : ${result.dnpName}
      Release hash : ${result.releaseMultiHash}
      ${getInstallDnpLink(result.releaseMultiHash)}
    `);
    }
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function buildHandler({
  provider,
  timeout,
  upload_to,
  skip_save,
  skip_upload,
  require_git_data,
  delete_old_pins,
  template,
  variantsDir = defaultVariantsDir,
  variants,
  // Global options
  dir = defaultDir,
  compose_file_name = defaultComposeFileName,
  silent,
  verbose
}: CliCommandOptions): Promise<ListrContextBuildAndPublish[]> {
  // Parse options
  const contentProvider = provider;
  const uploadTo = upload_to;
  const userTimeout = timeout;
  const skipSave = skip_save;
  const skipUpload = skip_save || skip_upload;
  const composeFileName = compose_file_name;
  const nextVersion = getCurrentLocalVersion({ dir });
  const buildDir = path.join(dir, `build_${nextVersion}`);

  const packageVariantsDir = path.join(dir, variantsDir);

  const variantNames = !template ?
    []
    : variants ?
      variants.split(",")
      : getAllDirectoryNamesInPath(packageVariantsDir);

  if (template)
    console.log(`${chalk.dim(`Building package from template for variants ${variants}...`)}`);

  const buildOptions: BuildAndUploadOptions = {
    dir,
    buildDir,
    contentProvider,
    uploadTo,
    userTimeout,
    skipSave,
    skipUpload,
    composeFileName,
    requireGitData: require_git_data,
    deleteOldPins: delete_old_pins,
    packageVariantsDir,
  };

  const buildTasks = variantNames.length == 0 ? [new Listr(
    buildAndUpload(buildOptions),
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  )] :
    variantNames.map((variantName) => new Listr(
      buildAndUpload({ ...buildOptions, variantName }),
      { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
    ));

  return await Promise.all(buildTasks.map((task) => task.run()));
}

/**
 * Reads all directory names within a given path.
 * @param {string} packageVariantsPath The path where to look for directories.
 * @returns {string[]} An array of directory names found in the given path.
 */
function getAllDirectoryNamesInPath(packageVariantsPath: string): string[] {
  try {
    const items = fs.readdirSync(packageVariantsPath, { withFileTypes: true });
    const directories = items.filter(item => item.isDirectory()).map(dir => dir.name);
    return directories;
  } catch (error) {
    console.error(`Error reading directory names in path: ${packageVariantsPath}`, error);
    throw error; // Or return an empty array if you prefer not to throw an error
  }
}