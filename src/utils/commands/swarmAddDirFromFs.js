const Swarm = require("../Swarm");
const getDirSize = require("../getDirSize");

async function swarmAddDirFromFs(dirPath, swarmProvider, logger) {
  const swarm = new Swarm(swarmProvider);

  // Create progress logger, log to Listr inter task output
  const totalSize = getDirSize(dirPath);
  const progress = prog => {
    if (prog / totalSize > 1.05)
      logger(`Uploading... ${prog} / ${totalSize} bytes`);
    else if (prog / totalSize > 1) logger("Uploading... 100%");
    else logger("Uploading... " + ((prog / totalSize) * 100).toFixed(2) + "%");
  };
  const rootHash = await swarm.addDirFromFs(dirPath, progress);
  return `/bzz/${rootHash}`;
}

module.exports = swarmAddDirFromFs;
