import chalk from "chalk";
import Listr from "listr";
import { CommandModule } from "yargs";
// Utils
import { verifyAvatar } from "../utils/verifyAvatar";
import { getAssetPath } from "../utils/getAssetPath";
import { releaseFiles } from "../params";
import { verifyIpfsConnection } from "../utils/verifyIpfsConnection";
import { readManifest, writeManifest } from "../utils/manifest";
import { ipfsAddFromFs } from "../utils/ipfs/ipfsAddFromFs";
import { CliGlobalOptions } from "../types";

interface CliCommandOptions extends CliGlobalOptions {
  provider: string;
}

export const addAvatar: CommandModule<CliGlobalOptions, CliCommandOptions> = {
  command: "add_avatar",
  describe: "Upload .png avatar and add it to the manifest",

  builder: {
    provider: {
      alias: "p",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    }
  },

  handler: async ({
    provider,
    // Global options
    dir,
    silent,
    verbose
  }): Promise<void> => {
    // Parse options
    const ipfsProvider = provider;

    await verifyIpfsConnection(ipfsProvider);

    const addAvatarTasks = new Listr(
      [
        {
          title: "Uploading avatar to IPFS",
          task: async (ctx, task) => {
            const avatarPath = getAssetPath(releaseFiles.avatar, dir);
            if (!avatarPath) throw Error("Avatar path not found");
            verifyAvatar(avatarPath);
            task.output = `Found ${avatarPath}`;

            const manifest = readManifest(dir);
            // Starts with /ipfs/
            manifest.avatar = await ipfsAddFromFs(avatarPath, ipfsProvider);
            writeManifest(dir, manifest);

            ctx.avatarIpfsPath = manifest.avatar;
          }
        }
      ],
      { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
    );

    const { avatarIpfsPath } = await addAvatarTasks.run();

    console.log(`
    ${chalk.green("DNP (DAppNode Package) avatar uploaded")} 
Avatar hash  : ${avatarIpfsPath}
`);
  }
};
