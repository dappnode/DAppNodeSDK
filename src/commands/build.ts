import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import Listr from "listr";
// Tasks
import { buildAndUpload } from "../tasks/buildAndUpload";
// Utils
import { getCurrentLocalVersion } from "../utils/versions/getCurrentLocalVersion";
import { verifyIpfsConnection } from "../utils/verifyIpfsConnection";
import { getInstallDnpLink } from "../utils/getLinks";
import { CliGlobalOptions } from "../types";

interface CliCommandOptions extends CliGlobalOptions {
  provider: string;
  timeout: string;
  upload_to: "ipfs" | "swarm";
  skip_save?: boolean;
  skip_upload?: boolean;
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
    timeout: {
      alias: "t",
      description: `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`,
      default: "15min"
    },
    upload_to: {
      alias: "upload_to",
      description: `Specify where to upload the release`,
      choices: ["ipfs", "swarm"],
      default: "ipfs"
    },
    skip_save: {
      description: `For testing only: do not save image to disk`,
      type: "boolean"
    },
    skip_upload: {
      description: `For testing only: do not upload image from disk`,
      type: "boolean"
    }
  },

  handler: async ({
    provider,
    timeout,
    upload_to,
    skip_save,
    skip_upload,
    // Global options
    dir,
    silent,
    verbose
  }): Promise<void> => {
    // Parse options
    const ipfsProvider = provider;
    const swarmProvider = provider;
    const userTimeout = timeout;
    const uploadToSwarm = upload_to === "swarm";
    const skipSave = skip_save;
    const skipUpload = skip_save || skip_upload;
    const nextVersion = getCurrentLocalVersion({ dir });
    const buildDir = path.join(dir, `build_${nextVersion}`);

    if (!skipUpload) await verifyIpfsConnection(ipfsProvider);

    const buildTasks = new Listr(
      buildAndUpload({
        dir,
        buildDir,
        ipfsProvider,
        swarmProvider,
        userTimeout,
        uploadToSwarm,
        skipSave,
        skipUpload
      }),
      { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
    );

    const { releaseMultiHash } = await buildTasks.run();

    if (skipUpload) {
      return console.log(chalk.green("\nDNP (DAppNode Package) built"));
    }

    console.log(`
  ${chalk.green("DNP (DAppNode Package) built and uploaded")} 
  Release hash : ${releaseMultiHash}
  ${getInstallDnpLink(releaseMultiHash)}
`);
  }
};
