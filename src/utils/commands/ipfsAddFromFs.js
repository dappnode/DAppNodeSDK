const Ipfs = require("../Ipfs");
const fs = require("fs");

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
    .then(res => res[0]);
}

module.exports = ipfsAddFromFs;
