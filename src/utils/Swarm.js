const tarFS = require("tar-fs");
const request = require("request");

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
 * - "my.ipfs.dnp.dappnode.eth"
 * @return {Object} apm instance
 */
function Swarm(provider) {
  const gatewayUrl = getSwarmGatewayUrl(provider);

  async function addDirFromFs(path, progress) {
    const url = `${gatewayUrl}/bzz:/`;
    let totalData = 0;
    return new Promise((resolve, reject) => {
      request.post(
        url,
        {
          headers: { "content-type": "application/x-tar" },
          body: tarFS.pack(path).on("data", chunk => {
            totalData += chunk.length;
            progress(totalData);
          })
        },
        (err, res, body) => {
          if (err) reject(err);
          else if (res.statusCode !== 200)
            reject(`Status code ${res.statusCode}`);
          else resolve(body);
        }
      );
    });
  }

  // return exposed methods
  return {
    addDirFromFs
  };
}

module.exports = Swarm;
