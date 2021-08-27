import fs from "fs";
import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import semver from "semver";
import inquirer from "inquirer";
import { writeManifest, getManifestPath } from "../utils/manifest";
import { writeCompose, getComposePath } from "../utils/compose";
import defaultAvatar from "../assets/defaultAvatar";
import { shell } from "../utils/shell";
import {
  defaultComposeFileName,
  defaultDir,
  defaultManifestFileName,
  defaultManifestFormat,
  getImageTag,
  releaseFiles,
  YargsError
} from "../params";
import { CliGlobalOptions, Compose, Manifest } from "../types";

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

ENTRYPOINT echo "happy buidl $USERNAME!"
`;

// .gitignore
const gitignorePath = ".gitignore";
const gitignoreCheck = "build_*";
const gitignoreData = `# DAppNodeSDK release directories
build_*
`;

interface CliCommandOptions extends CliGlobalOptions {
  yes?: boolean;
  force?: boolean;
}

export const init: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "init",
  describe: "Initialize a new DAppNodePackage (DNP) repository",

  builder: yargs =>
    yargs
      .option("yes", {
        alias: "y",
        description:
          "Answer yes or the default option to all initialization questions",
        type: "boolean"
      })
      .option("force", {
        alias: "f",
        description: "Overwrite previous project if necessary",
        type: "boolean"
      }),

  handler: async args => {
    const manifest = await initHandler(args);

    const dir = args.dir || defaultDir;
    console.log(`
    ${chalk.green("Your DAppNodePackage is ready")}: ${manifest.name}

To start, you can:

- Develop your dockerized app in   ${path.join(dir, dockerfilePath)}
- Add settings in the compose at   ${path.join(dir, defaultComposeFileName)}
- Add metadata in the manifest at  ${path.join(dir, defaultManifestFileName)}

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
  yes: useDefaults,
  force
}: CliCommandOptions): Promise<Manifest> {
  const composeFileName = compose_file_name;
  // shell outputs tend to include trailing spaces and new lines
  const directoryName = await shell('echo "${PWD##*/}"');
  const defaultAuthor = await shell("whoami");
  const defaultName = getDnpName(directoryName);

  const defaultAnswers = {
    name: defaultName,
    version: defaultVersion,
    description: `${defaultName} description`,
    avatar: "",
    type: "service",
    author: defaultAuthor,
    license: "GLP-3.0"
  };

  if (!useDefaults) {
    console.log(`This utility will walk you through creating a dappnode_package.json file.
It only covers the most common items, and tries to guess sensible defaults.
`);
  }

  const answers = useDefaults
    ? defaultAnswers
    : await inquirer.prompt([
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
          validate: val =>
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
      ]);

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
    version: "3.4",
    services: {
      [serviceName]: {
        build: ".", // Dockerfile is in root dir
        image: getImageTag({ dnpName, serviceName, version }),
        restart: "unless-stopped"
      }
    }
  };

  // Create package root dir
  fs.mkdirSync(dir, { recursive: true });

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
  writeManifest(manifest, defaultManifestFormat, { dir });

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
