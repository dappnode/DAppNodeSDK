import { ipfsVersion } from "./ipfs/ipfsVersion";

/**
 * Verify the IPFS connection
 * @param ipfsProvider
 */
export async function verifyIpfsConnection(ipfsProvider: string) {
  try {
    await ipfsVersion(ipfsProvider);
  } catch (e) {
    // On IPFS version 0.5 only POST methods are allowed
    // Tolerate errors 405 to be more backwards compatible
    if (e.message.includes("Method Not Allowed")) return;

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

function error(msg: string) {
  console.error("");
  console.error(msg);
  process.exit(1);
}
