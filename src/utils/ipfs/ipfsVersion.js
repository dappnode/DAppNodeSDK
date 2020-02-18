const got = require("got");
const { normalizeIpfsProvider } = require("./ipfsProvider");

/**
 * Show ipfs version information
 * @param {string} ipfsProvider "dappnode" | "http://localhost:5001"
 * @returns {Promise<Object>} {
 *   Version: "0.4.21",
 *   Commit: "8ca278f45",
 *   Repo: "7",
 *   System: "amd64/linux",
 *   Golang: "go1.12.6"
 * }
 */
async function ipfsVersion(ipfsProvider) {
  // Parse the ipfsProvider the a full base apiUrl
  const apiUrl = normalizeIpfsProvider(ipfsProvider);
  const res = await got({
    prefixUrl: apiUrl,
    url: "/api/v0/version",
    method: "GET",
    responseType: "json"
  });

  return res.body;
}

module.exports = ipfsVersion;
