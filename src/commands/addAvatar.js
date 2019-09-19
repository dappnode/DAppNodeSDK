const chalk = require("chalk");
const Listr = require("listr");
// Utils
const verifyIpfsConnection = require("../utils/verifyIpfsConnection");
const { readManifest, writeManifest } = require("../utils/manifest");
const getPathRootAvatarAndVerify = require("../utils/getPathRootAvatarAndVerify");
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
          const avatarPath = getPathRootAvatarAndVerify(dir);
          task.output = `Found ${avatarPath}`;

          const manifest = readManifest({ dir });
          // Starts with /ipfs/
          manifest.avatar = await ipfsAddFromFs(avatarPath, ipfsProvider);
          writeManifest({ manifest, dir });

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
};
