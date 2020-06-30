import { ipfsVersion } from "./ipfs/ipfsVersion";
import { CliError } from "../params";

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
        throw new CliError(
          `Can't connect to DAppNode, check your VPN connection`
        );
      } else if (ipfsProvider === "infura") {
        throw new CliError(`Can't connect to Infura's ipfs endpoint`);
      } else {
        throw new CliError(`Could not reach IPFS provider at ${ipfsProvider}`);
      }
    } else {
      throw e;
    }
  }
}
