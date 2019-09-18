const Ipfs = require("../Ipfs");
const path = require("path");
const getDirSize = require("../getDirSize");

/**
 * Uploads a directory from the fs
 * @param {*} dirPath
 * @param {*} ipfsProvider
 * @param {*} param2
 * @returns {string} "/ipfs/QmasUHASUDBIAUBSDIbaisd"
 */
async function ipfsAddDirFromFs(dirPath, ipfsProvider, { logger }) {
  const ipfs = new Ipfs(ipfsProvider);

  const showProgress = !(ipfsProvider || "").includes("infura");
  // Create progress logger, log to Listr inter task output
  const totalSize = getDirSize(dirPath);
  const progress = prog => {
    const completedFraction = prog / totalSize > 1 ? 1 : prog / totalSize;
    logger("Uploading... " + (completedFraction * 100).toFixed(2) + "%");
  };
  const entries = await ipfs.addFromFs(dirPath, {
    pin: true,
    recursive: true,
    ...(showProgress ? { progress } : {})
  });

  // path.normalize must be used to compare "./build_0.1.0" to "build_0.1.0"
  const rootEntry = entries.find(
    entry => path.normalize(entry.path) === path.normalize(dirPath)
  );
  if (!rootEntry)
    throw Error(`No root entry found: ${JSON.stringify(entries)}`);
  else return `/ipfs/${rootEntry.hash}`;
}

module.exports = ipfsAddDirFromFs;
