import got from "got";
import { normalizeIpfsProvider } from "./ipfsProvider";

interface IpfsApiVersionResponse {
  Version: string; // "0.4.21",
  Commit: string; // "8ca278f45",
  Repo: string; // "7",
  System: string; // "amd64/linux",
  Golang: string; // "go1.12.6"
}

/**
 * Show ipfs version information
 * @param ipfsProvider "dappnode" | "http://localhost:5001"
 */
export async function ipfsVersion(
  ipfsProvider: string
): Promise<IpfsApiVersionResponse> {
  // Parse the ipfsProvider the a full base apiUrl
  const apiUrl = normalizeIpfsProvider(ipfsProvider);
  const res = await got<IpfsApiVersionResponse>({
    prefixUrl: apiUrl,
    url: "/api/v0/version",
    method: "POST",
    responseType: "json"
  });

  return res.body;
}
