const Ipfs = require("./Ipfs");

/**
 * Verify the IPFS connection
 * @param {string} ipfsProvider
 */
async function verifyIpfsConnection({ ipfsProvider }) {
  try {
    const ipfs = new Ipfs(ipfsProvider);
    await ipfs.version();
  } catch (e) {
    if (e.code === "ENOTFOUND") {
      if (ipfsProvider === "dappnode") {
        error(`Can't connect to DAppNode, check your VPN connection`);
      } else if (ipfsProvider === "infura") {
        error(`Can't connect to Infura's ipfs endpoint`);
      } else {
        error(`Could not reach IPFS provider at ${ipfsProvider}`);
      }
    } else {
      throw e;
    }
  }
}

function error(msg) {
  console.error("");
  console.error(msg);
  process.exit(1);
}

module.exports = verifyIpfsConnection;
