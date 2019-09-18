const Ipfs = require("../Ipfs");
const fs = require("fs");
const path = require("path");

async function ipfsAddDirFromFs(dirPath, ipfsProvider, { logger }) {
  const ipfs = new Ipfs(ipfsProvider);

  const showProgress = !(ipfsProvider || "").includes("infura");
  // Create progress logger, log to Listr inter task output
  const totalSize = fs.statSync(dirPath).size;
  const progress = prog => {
    logger("Uploading... " + ((prog / totalSize) * 100).toFixed(2) + "%");
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
  else return rootEntry;
}

module.exports = ipfsAddDirFromFs;
