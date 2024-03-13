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
  writeManifest as writeManifests
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

type TemplateAnswers = {
  variantsDir?: string;
  variants?: string[];
  envName?: string;
};

type DefaultAnswers = Pick<Manifest, "name" | "version" | "description" | "avatar" | "type" | "author" | "license">;

type UserAnswers = DefaultAnswers & TemplateAnswers;

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

dappnodesdk build 
`);
  }
};

/**
 * Common handler for CLI and programatic usage
 */
export async function initHandler({
  dir = defaultDir,
  compose_file_name = defaultComposeFileName,
  yes,
  force,
  template
}: CliCommandOptions): Promise<Manifest> {
  const templateMode = !!template;
  const useDefaults = !!yes;
  const composeFileName = compose_file_name;
  // shell outputs tend to include trailing spaces and new lines
  const directoryName = await shell('echo "${PWD##*/}"');
  const defaultName = getDnpName(directoryName);

  const answers = await getUserAnswers({ templateMode, useDefaults, defaultName });

  // Construct DNP
  const dnpName = answers.name ? getDnpName(answers.name) : defaultName;
  const serviceName = dnpName;
  const version = answers.version || defaultVersion;

  const manifest: Manifest = {
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

  const compose: Compose = {
    version: "3.5",
    services: {
      [serviceName]: {
        build: ".", // Dockerfile is in root dir
        image: getImageTag({ dnpName, serviceName, version }),
        restart: "unless-stopped"
      }
    }
  };

  createPackageDirectories(dir, answers, templateMode);

  const manifestPath = getManifestPath(defaultManifestFormat, { dir });
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

  // Write manifest and compose
  writeManifests({ manifest, format: defaultManifestFormat, paths: { dir } });

  // Only write a compose if it doesn't exist
  if (!fs.existsSync(getComposePath({ dir }))) {
    writeCompose(compose, { dir, composeFileName });
  }

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

  return manifest;
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

async function getUserAnswers({ templateMode, useDefaults, defaultName }: { templateMode: boolean, useDefaults: boolean, defaultName: string }): Promise<UserAnswers> {
  const defaultAuthor = await shell("whoami");

  const defaultAnswers: DefaultAnswers = {
    name: defaultName,
    version: defaultVersion,
    description: `${defaultName} description`,
    avatar: "",
    type: "service",
    author: defaultAuthor,
    license: "GPL-3.0"
  };

  if (!useDefaults) {
    console.log(`This utility will walk you through creating a dappnode_package.json file.
It only covers the most common items, and tries to guess sensible defaults.
`);
  }

  let answers: UserAnswers = useDefaults
    ? defaultAnswers
    : await getSinglePackageAnswers(defaultAnswers);

  if (templateMode) {
    const templateAnswers = await getTemplateAnswers();
    answers = { ...answers, ...templateAnswers };
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

async function getTemplateAnswers(): Promise<TemplateAnswers> {
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
    variants: templateAnswers.variants.split(",").map((s: string) => s.trim())
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