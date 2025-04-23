import { ipfsVersion } from "./ipfsVersion.js";
import { ReleaseUploaderConnectionError } from "../errors.js";

/**
 * Verify the IPFS connection
 * @param ipfsProvider
 */
export async function verifyIpfsConnection(
  ipfsApiUrl: string
): Promise<void> {
  try {
    await ipfsVersion(ipfsApiUrl);
  } catch (e) {
    // On IPFS version 0.5 only POST methods are allowed
    // Tolerate errors 405 to be more backwards compatible
    if (e.message.includes("Method Not Allowed")) return;

    if (e.code === "ENOTFOUND") {
      throw new ReleaseUploaderConnectionError({
        url: ipfsApiUrl,
        reason: "ENOTFOUND",
        // .dappnode URLs are internal to DAppNode use
        help:
          ipfsApiUrl.endsWith(".dappnode") ? "Check your VPN connection" : undefined
      });
    } else {
      throw new ReleaseUploaderConnectionError({
        url: ipfsApiUrl,
        reason: e.message
      });
    }
  }
}
