import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import {
  defaultComposeFileName,
  defaultDir,
  defaultManifestFileName,
  defaultVariantsDirName
} from "../../params.js";
import { CliGlobalOptions } from "../../types.js";
import { InitCommandOptions } from "./types.js";
import { dockerfileName } from "./params.js";
import { initHandler } from "./handler.js";

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

- Develop your dockerized app in   ${path.join(dir, dockerfileName)}
- Add settings in the compose at   ${path.join(dir, defaultComposeFileName)}
- Add metadata in the manifest at  ${path.join(dir, defaultManifestFileName)}
${args.use_variants ? `- Define the specific features of each variant in ${path.join(dir, defaultVariantsDirName)}` : ""}

Once ready, you can build, install, and test it by running

dappnodesdk build 
`);
  }
};
