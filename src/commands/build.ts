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
    }
  },

  handler: async ({
    provider,
    timeout,
    upload_to,
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
    const nextVersion = getCurrentLocalVersion({ dir });
    const buildDir = path.join(dir, `build_${nextVersion}`);

    await verifyIpfsConnection(ipfsProvider);

    const buildTasks = new Listr(
      buildAndUpload({
        dir,
        buildDir,
        ipfsProvider,
        swarmProvider,
        userTimeout,
        uploadToSwarm
      }),
      { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
    );

    const { releaseMultiHash } = await buildTasks.run();

    console.log(`
  ${chalk.green("DNP (DAppNode Package) built and uploaded")} 
  Release hash : ${releaseMultiHash}
  ${getInstallDnpLink(releaseMultiHash)}
`);
  }
};
