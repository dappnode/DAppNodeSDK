import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import { shell } from "../../utils/shell.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultManifestFileName,
  defaultVariantsDir
} from "../../params.js";
import { CliGlobalOptions } from "../../types.js";
import { Manifest, Compose, getImageTag } from "@dappnode/types";
import { getUserAnswers } from "./getUserAnswers.js";
import { createPackageDirectories } from "./createPackageDirectories.js";
import { defaultVersion, dockerfilePath } from "./params.js";
import { writePackageFiles } from "./writePackageFiles.js";
import { getDnpName } from "./getDnpName.js";
import { getShortDnpName } from "./getShortDnpName.js";

interface CliCommandOptions extends CliGlobalOptions {
  yes: boolean;
  force: boolean;
  template: boolean;
}

export const init: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "init",
  describe: "Initialize a new DAppNodePackage (DNP) repository",

  builder: {
    yes: {
      alias: "y",
      description:
        "Answer yes or the default option to all initialization questions",
      type: "boolean",
      default: false
    },
    force: {
      alias: "f",
      description: "Overwrite previous project if necessary",
      type: "boolean",
      default: false
    },
    template: {
      alias: "t",
      description: "Initialize a template DAppNodePackage, for creating several package variants that have the same base structure.",
      type: "boolean",
      default: false
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
  yes: useDefaults = false,
  force = false,
  template: templateMode = false
}: CliCommandOptions): Promise<Manifest> {
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

  writePackageFiles({ dir, answers, templateMode, force, rootManifest, rootCompose, composeFileName, serviceName });

  return rootManifest;
}
