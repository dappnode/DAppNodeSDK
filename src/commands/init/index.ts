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
} from "../../files/index.js";
import { shell } from "../../utils/shell.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultManifestFileName,
  defaultManifestFormat,
  defaultVariantsDir,
  defaultVariantsEnvName,
  defaultVariantsEnvValues,
  YargsError
} from "../../params.js";
import { CliGlobalOptions } from "../../types.js";
import { Manifest, Compose, getImageTag, releaseFiles } from "@dappnode/types";
import { FlexibleCompose } from "../../files/compose/types.js";
import { validateDnpName } from "./validation.js";
import { DefaultAnswers, InitCommandOptions, TemplateAnswers, UserAnswers } from "./types.js";
import { avatarData, avatarPath, defaultVersion, dockerfileData, dockerfilePath, gitignoreCheck, gitignoreData, gitignorePath, publicRepoDomain, stringsToRemoveFromName } from "./params.js";

export const init: CommandModule<CliGlobalOptions, InitCommandOptions> = {
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
    use_variants: {
      alias: "t",
      description: "Initialize a template Dappnode package, for creating several package variants that have the same base structure.",
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
${args.use_variants && `- Define the specific features of each variant in ${path.join(dir, defaultVariantsDir)}`}

Once ready, you can build, install, and test it by running

dappnodesdk build 
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
  use_variants
}: InitCommandOptions): Promise<Manifest> {
  const useVariants = !!use_variants;
  const useDefaults = !!yes;

  // shell outputs tend to include trailing spaces and new lines
  const directoryName = await shell('echo "${PWD##*/}"');
  const defaultName = getDnpName(directoryName);

  const answers = await getUserAnswers({ useVariants, useDefaults, defaultName });

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

  createPackageDirectories(dir, answers, useVariants);
  writePackageFiles({ dir, answers, useVariants, force: !!force, rootManifest, rootCompose, composeFileName, serviceName });

  // Add default avatar so users can run the command right away
  const files = fs.readdirSync(dir);
  const avatarFile = files.find(file => releaseFiles.avatar.regex.test(file));
  if (!avatarFile) {
    fs.writeFileSync(
      path.join(dir, avatarPath),
      Buffer.from(avatarData, "base64")
    );
  }

  // Initialize Dockerfile
  fs.writeFileSync(path.join(dir, dockerfilePath), dockerfileData);

  // Initialize .gitignore
  writeGitIgnore(path.join(dir, gitignorePath));

  return rootManifest;
}

async function getUserAnswers({ useVariants, useDefaults, defaultName }: { useVariants: boolean, useDefaults: boolean, defaultName: string }): Promise<UserAnswers> {
  const defaultAuthor = await shell("whoami");

  const defaultVariantAnswers: TemplateAnswers = {
    envName: defaultVariantsEnvName,
    variantsDir: defaultVariantsDir,
    variants: defaultVariantsEnvValues
  };

  const defaultAnswers: UserAnswers = {
    name: defaultName,
    version: defaultVersion,
    description: `${defaultName} description`,
    avatar: "",
    type: "service",
    author: defaultAuthor,
    license: "GPL-3.0",
    ...useVariants ? defaultVariantAnswers : {}
  };

  if (useDefaults) return defaultAnswers;

  console.log(`This utility will walk you through creating a dappnode_package.json file.
It only covers the most common items, and tries to guess sensible defaults.
`);

  const answers: UserAnswers = await getSinglePackageAnswers(defaultAnswers);

  if (useVariants) {
    const templateAnswers = await getVariantAnswers();
    return { ...answers, ...templateAnswers };
  }

  return answers;
}

async function getSinglePackageAnswers(defaultAnswers: DefaultAnswers): Promise<UserAnswers> {
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

async function getVariantAnswers(): Promise<TemplateAnswers> {
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
      default: defaultVariantsEnvValues,
      validate: (input: string) => validateVariantsInput(input),
    },
    {
      type: "input",
      name: "envName",
      message: "Environment variable name to differentiate the variants (Example: NETWORK)",
      default: defaultVariantsEnvName
    }
    ]);

  return {
    ...templateAnswers,
    variants: templateAnswers.variants.split(",").map((s: string) => s.trim())
  }
}

function createPackageDirectories(dir: string, answers: UserAnswers, templateMode: boolean): void {
  // Create package root dir
  fs.mkdirSync(dir, { recursive: true });

  // Create all variant dirs
  if (templateMode && answers.variants) {
    const variantsDir = answers.variantsDir || defaultVariantsDir;

    fs.mkdirSync(path.join(dir, variantsDir), { recursive: true });

    for (const variant of answers.variants) {
      fs.mkdirSync(path.join(dir, variantsDir, variant), { recursive: true });
    }
  }
}

function writePackageFiles({
  dir,
  answers,
  useVariants,
  force,
  rootManifest,
  rootCompose,
  composeFileName,
  serviceName
}: {
  dir: string,
  answers: UserAnswers,
  useVariants: boolean,
  force: boolean,
  rootManifest: Manifest,
  rootCompose: Compose,
  composeFileName: string,
  serviceName: string
}): void {
  const rootManifestPath = getManifestPath(defaultManifestFormat, { dir });
  confirmManifestOverwrite(rootManifestPath, force);

  if (!useVariants)
    return writeSinglePackageFiles({ dir, rootManifest, rootCompose, composeFileName });

  writeTemplatePackageFiles({ dir, rootManifest, rootCompose, composeFileName, answers, serviceName });
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
  const envName = answers.envName || defaultVariantsEnvName;

  // All except name and version
  const templateRootManifest = { ...rootManifest, name: undefined, version: undefined };

  // Write the root manifest
  writeManifest<Partial<Manifest>>(templateRootManifest, defaultManifestFormat, { dir });

  // Write the root compose
  writeCompose<FlexibleCompose>(removeImageFromCompose(rootCompose, serviceName), { dir, composeFileName });

  // Write the variants
  const variantsDir = answers.variantsDir || defaultVariantsDir;

  for (const variant of answers.variants || []) {
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
}

/**
 * Make sure there's a gitignore for the builds or create it
 */
function writeGitIgnore(filepath: string) {
  if (fs.existsSync(filepath)) {
    const currentGitignore = fs.readFileSync(filepath, "utf8");
    if (!currentGitignore.includes(gitignoreCheck))
      fs.writeFileSync(filepath, currentGitignore + gitignoreData);
  } else {
    fs.writeFileSync(filepath, gitignoreData);
  }
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