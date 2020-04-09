const tarFS = require("tar-fs");
const got = require("got");

function getSwarmGatewayUrl(provider = "dappnode") {
  if (provider === "dappnode") {
    return "http://swarm.dappnode";
  } else if (provider === "public") {
    return "https://swarm-gateways.net";
  } else {
    return provider;
  }
}

/**
 *
 * @param {String} provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "localhost:5002"
 * - "ipfs.dappnode"
 * @return {Object} apm instance
 */
function Swarm(provider) {
  const gatewayUrl = getSwarmGatewayUrl(provider);

  async function addDirFromFs(path, onProgress) {
    const res = await got({
      prefixUrl: gatewayUrl,
      url: "/bzz:/",
      method: "POST",
      headers: { "content-type": "application/x-tar" },
      body: tarFS.pack(path)
    }).on("uploadProgress", progress => {
      // Report upload progress
      // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
      if (onProgress) onProgress(progress.percent);
    });

    return res.body;
  }

  // return exposed methods
  return {
    addDirFromFs
  };
}

module.exports = Swarm;
