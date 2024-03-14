import fs from "fs";
import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import semver from "semver";
import inquirer from "inquirer";
import {
  writeCompose,
  getComposePath,
  getManifestPath,
  writeManifest
} from "../files/index.js";
import defaultAvatar from "../assets/defaultAvatar.js";
import { shell } from "../utils/shell.js";
import { releasesRecordFileName } from "../utils/releaseRecord.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultManifestFileName,
  defaultManifestFormat,
  defaultVariantsDir,
  YargsError
} from "../params.js";
import { CliGlobalOptions } from "../types.js";
import { Manifest, Compose, getImageTag, releaseFiles } from "@dappnode/types";
import { FlexibleCompose } from "../files/compose/writeCompose.js";
import { writeFileIfNotExists } from "../files/common/writeFileIfNotExists.js";

const defaultEnvName = "NETWORK";
const defaultVariants = ["mainnet", "testnet"];

const stringsToRemoveFromName = [
  "DAppNode-package-",
  "DAppNodePackage-",
  "DAppNode-Package",
  "DAppNodePackage"
];

// Manifest
const publicRepoDomain = ".public.dappnode.eth";
const defaultVersion = "0.1.0";

// Avatar
const avatarPath = "avatar-default.png";
const avatarData = defaultAvatar;

// Dockerfile
const dockerfilePath = "Dockerfile";
const dockerfileData = `FROM busybox

WORKDIR /usr/src/app

ENTRYPOINT while true; do echo "happy build $USERNAME!"; sleep 1; done

`;

// .gitignore
const gitignorePath = ".gitignore";
const gitignoreCheck = "build_*";
const gitignoreData = `# DAppNodeSDK release directories
build_*
${releasesRecordFileName}
`;

type TemplatePackageAnswers = {
  variantsDir: string;
  variants: string[];
  envName: string;
};

type SinglePackageAnswers = Pick<Manifest, "name" | "version" | "description" | "avatar" | "type" | "author" | "license">;

type UserAnswers = SinglePackageAnswers & Partial<TemplatePackageAnswers>;

interface CliCommandOptions extends CliGlobalOptions {
  yes?: boolean;
  force?: boolean;
  template?: boolean;
}

export const init: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "init",
  describe: "Initialize a new DAppNodePackage (DNP) repository",

  builder: {
    yes: {
      alias: "y",
      description:
        "Answer yes or the default option to all initialization questions",
      type: "boolean"
    },
    force: {
      alias: "f",
      description: "Overwrite previous project if necessary",
      type: "boolean"
    },
    template: {
      alias: "t",
      description: "Initialize a template DAppNodePackage, for creating several package variants that have the same base structure.",
      type: "boolean"
    }
  },
  handler: async args => {
    const manifest = await initHandler(args);

    const dir = args.dir || defaultDir;
    console.log(`
    ${chalk.green("Your DAppNodePackage is ready")}: ${manifest.name}

To start, you can:

- Develop your dockerized app in   ${path.join(dir, dockerfilePath)}
- Add settings in the compose at   ${path.join(dir, defaultComposeFileName)}
- Add metadata in the manifest at  ${path.join(dir, defaultManifestFileName)}
${args.template && `- Define the specific features of each variant in ${path.join(dir, defaultVariantsDir)}`}

Once ready, you can build, install, and test it by running

dappnodesdk build ${args.template && "--all_variants"}
`);
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function initHandler({
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  yes,
  force,
  template
}: CliCommandOptions): Promise<Manifest> {
  const templateMode = !!template;
  const useDefaults = !!yes;
  // shell outputs tend to include trailing spaces and new lines
  const directoryName = await shell('echo "${PWD##*/}"');
  const defaultName = getDnpName(directoryName);

  const answers = await getUserAnswers({ templateMode, useDefaults, defaultName });

  // Construct DNP
  const dnpName = answers.name ? getDnpName(answers.name) : defaultName;
  const serviceName = getShortDnpName(dnpName);
  const version = answers.version || defaultVersion;

  const rootManifest: Manifest = {
    name: dnpName,
    version: version,
    description: answers.description,
    type: "service",
    author: answers.author,
    categories: ["Developer tools"],
    links: {
      homepage: "https://your-project-homepage-or-docs.io"
    },
    license: answers.license
  };

  const rootCompose: Compose = {
    version: "3.5",
    services: {
      [serviceName]: {
        build: ".", // Dockerfile is in root dir
        image: getImageTag({ dnpName, serviceName, version }),
        restart: "unless-stopped"
      }
    }
  };

  createPackageDirectories(dir, answers.variants || [], answers.variantsDir || defaultVariantsDir, templateMode);

  writePackageFiles({ dir, answers, templateMode, force: !!force, rootManifest, rootCompose, composeFileName, serviceName });

  return rootManifest;
}

async function getUserAnswers({ templateMode, useDefaults, defaultName }: { templateMode: boolean, useDefaults: boolean, defaultName: string }): Promise<UserAnswers> {
  const defaultAuthor = await shell("whoami");

  const defaultAnswers: UserAnswers = {
    name: defaultName,
    version: defaultVersion,
    description: `${defaultName} description`,
    avatar: "",
    type: "service",
    author: defaultAuthor,
    license: "GPL-3.0",
    envName: defaultEnvName,
    variants: defaultVariants,
    variantsDir: defaultVariantsDir
  };

  if (useDefaults) return defaultAnswers;

  console.log(`This utility will walk you through creating a dappnode_package.json file.
It only covers the most common items, and tries to guess sensible defaults.
`);

  const answers: SinglePackageAnswers = await getSinglePackageAnswers(defaultAnswers);

  if (templateMode) {
    const templateAnswers = await getTemplateAnswers();
    return { ...answers, ...templateAnswers };
  }

  return answers;
}

async function getSinglePackageAnswers(defaultAnswers: SinglePackageAnswers): Promise<SinglePackageAnswers> {
  return inquirer.prompt([
    {
      type: "input",
      name: "name",
      default: defaultAnswers.name,
      message: "DAppNodePackage name"
    },
    {
      type: "input",
      name: "version",
      default: defaultAnswers.version,
      message: "Version",
      validate: (val: string | semver.SemVer) =>
        !semver.valid(val) ||
          !(
            semver.eq(val, "1.0.0") ||
            semver.eq(val, "0.1.0") ||
            semver.eq(val, "0.0.1")
          )
          ? "the version needs to be valid semver. If this is the first release, the version must be 1.0.0, 0.1.0 or 0.0.1 "
          : true
    },
    {
      type: "input",
      name: "description",
      message: "Description",
      default: defaultAnswers.description
    },
    {
      type: "input",
      message: "Author",
      name: "author",
      default: defaultAnswers.author
    },
    {
      type: "input",
      message: "License",
      name: "license",
      default: defaultAnswers.license
    }
  ]
  );
}

async function getTemplateAnswers(): Promise<TemplatePackageAnswers> {
  const templateAnswers = await inquirer.prompt(
    [{
      type: "input",
      name: "variantsDir",
      default: defaultVariantsDir,
      message: "Variants directory, where the different package variants are located",
    },
    {
      type: "input",
      name: "variants",
      message: "Variants (comma separated)",
      default: "mainnet,testnet",
      validate: (input: string) => validateVariantsInput(input),
      transformer: (input: string) => input.trim()
    },
    {
      type: "input",
      name: "envName",
      message: "Environment variable name to differentiate the variants (Example: NETWORK)",
      default: "NETWORK"
    }
    ]);

  return {
    ...templateAnswers,
    variants: templateAnswers.variants.split(",")
  }
}

function createPackageDirectories(dir: string, variants: string[], variantsDir: string, templateMode: boolean): void {
  // Create package root dir
  fs.mkdirSync(dir, { recursive: true });

  // Create all variant dirs
  if (templateMode && variants) {
    fs.mkdirSync(path.join(dir, variantsDir), { recursive: true });

    for (const variant of variants) {
      fs.mkdirSync(path.join(dir, variantsDir, variant), { recursive: true });
    }
  }
}


function writePackageFiles({
  dir,
  answers,
  templateMode,
  force,
  rootManifest,
  rootCompose,
  composeFileName,
  serviceName
}: {
  dir: string,
  answers: UserAnswers,
  templateMode: boolean,
  force: boolean,
  rootManifest: Manifest,
  rootCompose: Compose,
  composeFileName: string,
  serviceName: string
}): void {
  const rootManifestPath = getManifestPath(defaultManifestFormat, { dir });
  confirmManifestOverwrite(rootManifestPath, force);

  if (!templateMode)
    writeSinglePackageFiles({ dir, rootManifest, rootCompose, composeFileName });
  else
    writeTemplatePackageFiles({ dir, rootManifest, rootCompose, composeFileName, answers, serviceName });

  writeDefaultAvatar(dir);

  writeFileIfNotExists(path.join(dir, dockerfilePath), dockerfileData);

  // Initialize .gitignore
  writeGitIgnore(path.join(dir, gitignorePath));
}

function writeSinglePackageFiles({
  dir,
  rootManifest,
  rootCompose,
  composeFileName
}: {
  dir: string,
  rootManifest: Manifest,
  rootCompose: Compose,
  composeFileName: string
}): void {
  writeManifest<Manifest>(rootManifest, defaultManifestFormat, { dir });

  // Only write a compose if it doesn't exist
  if (!fs.existsSync(getComposePath({ dir }))) {
    writeCompose(rootCompose, { dir, composeFileName });
  }
}

function writeTemplatePackageFiles({
  dir,
  rootManifest,
  rootCompose,
  composeFileName,
  answers,
  serviceName
}: {
  dir: string,
  rootManifest: Manifest,
  rootCompose: Compose,
  composeFileName: string,
  answers: UserAnswers,
  serviceName: string
}): void {
  // All except name and version
  const templateRootManifest = { ...rootManifest, name: undefined, version: undefined };

  // Write the root manifest
  writeManifest<Partial<Manifest>>(templateRootManifest, defaultManifestFormat, { dir });

  // Write the root compose
  writeCompose<FlexibleCompose>(removeImageFromCompose(rootCompose, serviceName), { dir, composeFileName });

  for (const variant of answers.variants || []) {
    writeVariantFiles({ dir, rootManifest, composeFileName, variant, serviceName, answers });
  }
}

function writeVariantFiles({
  dir,
  rootManifest,
  composeFileName,
  variant,
  serviceName,
  answers
}: {
  dir: string,
  rootManifest: Manifest,
  composeFileName: string,
  variant: string,
  serviceName: string,
  answers: UserAnswers
}) {
  const envName = answers.envName || defaultEnvName;
  const variantsDir = answers.variantsDir || defaultVariantsDir;

  const variantDir = path.join(dir, variantsDir, variant);
  const variantName = addVariantToDnpName({ dnpName: rootManifest.name, variant });
  const variantManifest: Partial<Manifest> = { name: variantName, version: rootManifest.version };
  const variantCompose: Compose = {
    version: "3.5",
    services: {
      [serviceName]: {
        image: getImageTag({ dnpName: variantName, serviceName, version: rootManifest.version }),
        environment: {
          [envName]: variant
        }
      }
    }
  };
  writeManifest<Partial<Manifest>>(variantManifest, defaultManifestFormat, { dir: variantDir });
  writeCompose<Compose>(variantCompose, { dir: variantDir, composeFileName });
}

function writeDefaultAvatar(dir: string): void {
  const files = fs.readdirSync(dir);
  const avatarFile = files.find(file => releaseFiles.avatar.regex.test(file));
  if (!avatarFile) {
    fs.writeFileSync(
      path.join(dir, avatarPath),
      Buffer.from(avatarData, "base64")
    );
  }
}

/**
 * Make sure there's a gitignore for the builds or create it
 */
function writeGitIgnore(filepath: string) {
  const currentGitIgnore = fs.existsSync(filepath)
    ? fs.readFileSync(filepath, "utf8")
    : "";

  if (currentGitIgnore.includes(gitignoreCheck)) return;

  fs.writeFileSync(filepath, currentGitIgnore + gitignoreData);
}

function removeImageFromCompose(compose: Compose, serviceName: string): FlexibleCompose {
  return {
    ...compose,
    services: {
      ...compose.services,
      [serviceName]: {
        ...compose.services[serviceName],
        image: undefined
      }
    }
  };
}

/**
 * Check if the manifest already exists and ask for confirmation if it does
 * 
 * @param manifestPath
 * @param force
 * @throws YargsError if the user doesn't want to overwrite the manifest
 * @returns void
 */
async function confirmManifestOverwrite(manifestPath: string, force: boolean): Promise<void> {
  if (fs.existsSync(manifestPath) && !force) {
    const continueAnswer = await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message:
          "This directory is already initialized. Are you sure you want to overwrite the existing manifest?"
      }
    ]);
    if (!continueAnswer.continue) {
      throw new YargsError("Stopping");
    }
  }
}

/**
 * Parses a directory or generic package name and returns a full ENS guessed name
 * @param name "DAppNodePackage-vipnode"
 * @return "vipnode.public.dappnode.eth"
 */
function getDnpName(name: string): string {
  // Remove prepended strings if any
  for (const stringToRemove of stringsToRemoveFromName) {
    name = name.replace(stringToRemove, "");
  }

  // Make name lowercase
  name = name.toLowerCase();

  // Append public domain
  return name.endsWith(".eth") ? name : name + publicRepoDomain;
}

function validateVariantsInput(input: string): boolean | string {
  const variants = input.split(",").map(s => s.trim());
  const allNonEmpty = variants.every(variant => variant.length > 0);
  const uniqueVariants = new Set(variants).size === variants.length;

  if (variants.length < 2) {
    return "You need to specify at least two variants, separated by a comma. Example: mainnet,testnet";
  } else if (!allNonEmpty) {
    return "Empty variant detected. Please ensure all variants are non-empty.";
  } else if (!uniqueVariants) {
    return "Duplicate variants detected. Please ensure all variants are unique.";
  }
  return true;
}

function getShortDnpName(dnpName: string): string {
  validateDnpName(dnpName);
  return dnpName.split(".")[0];
}

/**
 * Adds a variant suffix to a DAppNode package (DNP) name, ensuring the variant is inserted
 * right before the domain part of the DNP name.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.dnpName - The original DNP name.
 * @param {string} params.variant - The variant to be added to the DNP name.
 * @returns {string} - The modified DNP name including the variant.
 *
 * @example
 * 
 * --> Adds the 'mainnet' variant to the DNP name
 * 
 * const modifiedDnpName = addVariantToDnpName({ dnpName: "geth.dnp.dappnode.eth", variant: "mainnet" });
 * console.log(modifiedDnpName);
 * 
 * --> Output: "geth-mainnet.dnp.dappnode.eth"
 */
function addVariantToDnpName({ dnpName, variant }: { dnpName: string, variant: string }): string {
  validateDnpName(dnpName);

  const firstDotAt = dnpName.indexOf(".");
  return `${dnpName.substring(0, firstDotAt)}-${variant}${dnpName.substring(firstDotAt)}`;
}

// TODO: Move these functions to somewhere it can be reused (maybe @dappnode/types?)
/**
 * Validates if a given dnpName follows the expected structure.
 * Expected format: <name>.<dnp|public>.dappnode.eth
 * 
 * @param {string} dnpName - The DAppNode package name to validate.
 * @returns {boolean} - Returns true if the dnpName is valid, false otherwise.
 */
function isValidDnpName(dnpName: string): boolean {
  const regex = /^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$/i;
  return regex.test(dnpName);
}

function validateDnpName(name: string): void {
  if (!isValidDnpName(name))
    throw new Error("Invalid DAppNode package name. Expected format: <name>.<dnp|public>.dappnode.eth");
}
