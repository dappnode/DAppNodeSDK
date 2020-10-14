import { ipfsVersion } from "./ipfsVersion";
import { ReleaseUploaderConnectionError } from "../errors";

/**
 * Verify the IPFS connection
 * @param ipfsProvider
 */
export async function verifyIpfsConnection(
  ipfsProvider: string
): Promise<void> {
  try {
    await ipfsVersion(ipfsProvider);
  } catch (e) {
    // On IPFS version 0.5 only POST methods are allowed
    // Tolerate errors 405 to be more backwards compatible
    if (e.message.includes("Method Not Allowed")) return;

    if (e.code === "ENOTFOUND") {
      throw new ReleaseUploaderConnectionError({
        ipfsProvider,
        reason: "ENOTFOUND",
        help:
          ipfsProvider === "dappnode" ? "Check your VPN connection" : undefined
      });
    } else {
      throw new ReleaseUploaderConnectionError({
        ipfsProvider,
        reason: e.message
      });
    }
  }
}
