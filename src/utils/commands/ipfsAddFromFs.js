const Ipfs = require("../Ipfs");
const fs = require("fs");

/**
 * A single file from the fs
 * @param {*} path
 * @param {*} ipfsProvider
 * @param {*} options
 * @returns {string} "/ipfs/QmasUHASUDBIAUBSDIbaisd"
 */
function ipfsAddFromFs(path, ipfsProvider, options) {
  const logger = (options || {}).logger || function() {};
  const ipfs = new Ipfs(ipfsProvider);

  const showProgress = !(ipfsProvider || "").includes("infura");
  // Create progress logger, log to Listr inter task output
  const totalSize = fs.statSync(path).size;
  const progress = prog => {
    logger("Uploading... " + ((prog / totalSize) * 100).toFixed(2) + "%");
  };
  return ipfs
    .addFromFs(path, {
      pin: true,
      ...(showProgress ? { progress } : {})
    })
    .then(res => `/ipfs/${res[0].hash}`);
}

module.exports = ipfsAddFromFs;
