const path = require("path");
const fs = require("fs");
const chalk = require("chalk");
const Listr = require("listr");
// Utils
const verifyIpfsConnection = require("../utils/verifyIpfsConnection");
const { readManifest, writeManifest } = require("../utils/manifest");
// Commands
const ipfsAddFromFs = require("../utils/commands/ipfsAddFromFs");

/**
 * INIT
 *
 * Initialize the repository
 */

exports.command = "add_avatar";

exports.describe = "Upload .png avatar and add it to the manifest";

exports.builder = yargs =>
  yargs.option("p", {
    alias: "provider",
    description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
    default: "dappnode"
  });

exports.handler = async ({
  provider,
  // Global options
  dir,
  silent,
  verbose
}) => {
  // Parse options
  const ipfsProvider = provider;

  await verifyIpfsConnection({ ipfsProvider });

  const addAvatarTasks = new Listr(
    [
      {
        title: "Uploading avatar to IPFS",
        task: async (ctx, task) => {
          /**
           * Try to find the avatar in the DNP folder
           */
          function getAvatarPath() {
            const files = fs.readdirSync(dir);
            const pngFiles = files.filter(file => file.endsWith(".png"));
            // If there is no .png throw Error
            if (pngFiles.length === 0)
              throw Error(`No .png avatar found in ${dir}`);
            // If there is only one png assume it's the avatar
            if (pngFiles.length === 1) return pngFiles[0];
            // Else, find if only one the .png contains the word avatar
            const pngAvatarFiles = files.filter(file =>
              file.toLowerCase().includes("avatar")
            );
            if (pngAvatarFiles.length === 1) return pngAvatarFiles[0];
            // At this point stop due to inconclusive results
            throw Error(
              `There are more than one .png, specify which should be the avatar by adding "avatar" to the file name`
            );
          }
          const avatarPath = path.join(dir, getAvatarPath());
          task.output = `Found ${avatarPath}`;
          const avatarUpload = await ipfsAddFromFs(avatarPath, ipfsProvider, {
            logger: msg => {
              task.output = msg;
            }
          });
          const avatarIpfsPath = `/ipfs/${avatarUpload.hash}`;

          const manifest = readManifest({ dir });
          manifest.avatar = avatarIpfsPath;
          writeManifest({ manifest, dir });

          ctx.avatarIpfsPath = avatarIpfsPath;
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
};
