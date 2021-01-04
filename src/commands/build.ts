import path from "path";
import chalk from "chalk";
import { CommandModule } from "yargs";
import Listr from "listr";
// Tasks
import { buildAndUpload } from "../tasks/buildAndUpload";
// Utils
import { getCurrentLocalVersion } from "../utils/versions/getCurrentLocalVersion";
import { getInstallDnpLink } from "../utils/getLinks";
import { CliGlobalOptions } from "../types";
import { UploadTo } from "../releaseUploader";

interface CliCommandOptions extends CliGlobalOptions {
  provider: string;
  timeout: string;
  upload_to: UploadTo;
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
      default: "60min"
    },
    upload_to: {
      alias: "upload_to",
      description: `Specify where to upload the release`,
      choices: ["ipfs", "swarm"] as UploadTo[],
      default: "ipfs" as UploadTo
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

  handler: async (args): Promise<void> => {
    const { releaseMultiHash } = await buildHandler(args);

    if (args.skipUpload) {
      return console.log(chalk.green("\nDNP (DAppNode Package) built\n"));
    }

    console.log(`
  ${chalk.green("DNP (DAppNode Package) built and uploaded")} 
  Release hash : ${releaseMultiHash}
  ${getInstallDnpLink(releaseMultiHash)}
`);
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
  // Global options
  dir,
  silent,
  verbose
}: CliCommandOptions): Promise<{ releaseMultiHash: string }> {
  // Parse options
  const contentProvider = provider;
  const uploadTo = upload_to;
  const userTimeout = timeout;
  const skipSave = skip_save;
  const skipUpload = skip_save || skip_upload;
  const nextVersion = getCurrentLocalVersion({ dir });
  const buildDir = path.join(dir, `build_${nextVersion}`);

  const buildTasks = new Listr(
    buildAndUpload({
      dir,
      buildDir,
      contentProvider,
      uploadTo,
      userTimeout,
      skipSave,
      skipUpload
    }),
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );

  const { releaseMultiHash } = await buildTasks.run();
  return { releaseMultiHash };
}
