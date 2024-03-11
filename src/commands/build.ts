import fs from "fs";
import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import Listr from "listr";
// Tasks
import { BuildAndUploadOptions, buildAndUpload } from "../tasks/buildAndUpload.js";
// Utils
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

interface VerbosityOptions {
  renderer: "verbose" | "silent" | "default";
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
      description: `Path to the directory where the package variants are located. By default, it is ${defaultVariantsDir}`,
      type: "string",
      default: defaultVariantsDir
    },
    variants: {
      description: `Specify the package variants to build (only in template mode). Defined by comma-separated list of variant names. If not specified, all variants will be built. Example: "variant1,variant2"`,
      type: "string"
    }
  },

  handler: async (args): Promise<void> => {
    const buildResults = await buildHandler(args);

    if (args.skipUpload) {
      return console.log(chalk.green("\nDNP (DAppNode Package) built\n"));
    }

    for (const result of buildResults) {
      console.log(`
      ${chalk.green(`Dappnode Package (${result.dnpName}) built and uploaded`)} 
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
export function buildHandler({
  provider: contentProvider,
  timeout: userTimeout,
  upload_to: uploadTo,
  skip_save: skipSave,
  skip_upload,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  template,
  variantsDir = defaultVariantsDir,
  variants,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: CliCommandOptions): Promise<ListrContextBuildAndPublish[]> {
  const skipUpload = skipSave || skip_upload;
  const templateMode = !!template;

  const buildOptions: BuildAndUploadOptions = {
    dir,
    contentProvider,
    uploadTo,
    userTimeout,
    skipSave,
    skipUpload,
    composeFileName,
    requireGitData,
    deleteOldPins,
  };

  const verbosityOptions: VerbosityOptions = { renderer: verbose ? "verbose" : silent ? "silent" : "default" }

  const buildTasks = templateMode ?
    handleTemplateBuild({ buildOptions, variantsDir, variants, verbosityOptions }) :
    handleSinglePkgBuild({ buildOptions, verbosityOptions });

  return Promise.all(buildTasks.map((task) => task.run()));
}

function handleTemplateBuild({
  buildOptions,
  variantsDir,
  variants,
  verbosityOptions
}: {
  buildOptions: BuildAndUploadOptions;
  variantsDir: string;
  variants?: string;
  verbosityOptions: VerbosityOptions;
}
): Listr<ListrContextBuildAndPublish>[] {
  const variantsDirPath = path.join(buildOptions.dir, variantsDir);
  const variantNames = getVariantNames({ variantsDirPath, variants });

  console.log(`${chalk.dim(`Building package from template for variants ${variants}...`)}`);

  return variantNames.map((variantName) => new Listr(
    buildAndUpload({ ...buildOptions, variantName, variantsDirPath }),
    verbosityOptions
  ));
}

function handleSinglePkgBuild({
  buildOptions,
  verbosityOptions
}: {
  buildOptions: BuildAndUploadOptions;
  verbosityOptions: VerbosityOptions;
}): Listr<ListrContextBuildAndPublish>[] {
  console.log(`${chalk.dim(`Building single package...`)}`);

  return [new Listr(
    buildAndUpload(buildOptions),
    verbosityOptions
  )];
}

/**
 * Retrieves the valid variant names based on the specified variants and the available directories.
 * 
 * @param {string} variantsDirPath - The path to the directory containing variant directories.
 * @param {string | undefined} variants - A comma-separated string of specified variant names.
 * @param {boolean} templateMode - Flag indicating if the template mode is enabled.
 * @returns {string[]} An array of valid variant names.
 */
function getVariantNames({ variantsDirPath, variants }: { variantsDirPath: string; variants?: string }): string[] {

  const allVariantNames = getAllDirectoryNamesInPath(variantsDirPath);

  if (!variants) {
    console.log(chalk.dim(`No variants specified. Building all available variants: ${allVariantNames.join(", ")}`));
    return allVariantNames; // If no specific variants are provided, use all available directories.
  }

  const specifiedVariantNames = variants.split(",").map(name => name.trim()); // Split and trim the specified variants to ensure clean comparisons.

  const { validVariants, invalidVariants } = specifiedVariantNames.reduce<{ validVariants: string[]; invalidVariants: string[] }>(
    (acc, name) => {
      if (allVariantNames.includes(name)) acc.validVariants.push(name);

      else acc.invalidVariants.push(name);

      return acc;
    }, { validVariants: [], invalidVariants: [] });


  if (invalidVariants.length > 0) {
    console.error(chalk.red(`Warning: Some specified variants are not valid and will be ignored. Allowed variants: ${variants}`));
    throw new Error(`Invalid variant names: ${invalidVariants.join(", ")}`);
  }

  return validVariants;
}

/**
 * Reads all directory names within a given path.
 * @param {string} packageVariantsPath The path where to look for directories.
 * @returns {string[]} An array of directory names found in the given path.
 */
function getAllDirectoryNamesInPath(packageVariantsPath: string): string[] {
  try {
    const items = fs.readdirSync(packageVariantsPath, { withFileTypes: true });
    return items.filter(item => item.isDirectory()).map(dir => dir.name);
  } catch (error) {
    console.error(`Error reading directory names in path: ${packageVariantsPath}`, error);
    throw error;
  }
}