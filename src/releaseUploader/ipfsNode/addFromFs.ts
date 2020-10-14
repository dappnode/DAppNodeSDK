import got from "got";
import { normalizeIpfsProvider } from "./ipfsProvider";
import { getFormDataFileUpload } from "../utils/formDataFileUpload";

/**
 * Uploads a directory or file from the fs
 * @param dirOrFile "docs"
 * @param ipfsProvider "dappnode" | "http://localhost:5001"
 * @param onProgress Report upload progress, 0.4631
 * @returns "/ipfs/Qm..."
 */
export async function ipfsAddFromFs(
  dirOrFilePath: string,
  ipfsProvider: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Create form and append all files recursively
  const form = getFormDataFileUpload(dirOrFilePath);

  // Parse the ipfsProvider the a full base apiUrl
  let lastPercent = -1;
  const apiUrl = normalizeIpfsProvider(ipfsProvider);
  const res = await got({
    prefixUrl: apiUrl,
    url: "api/v0/add",
    method: "POST",
    headers: form.getHeaders(),
    body: form
  }).on("uploadProgress", progress => {
    // Report upload progress, and throttle to one update per percent point
    // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
    const currentRoundPercent = Math.round(100 * progress.percent);
    if (lastPercent !== currentRoundPercent) {
      lastPercent = currentRoundPercent;
      if (onProgress) onProgress(progress.percent);
    }
  });

  // res.body = '{"Name":"dir/file","Hash":"Qm...","Size":"2203"}\n{"Name":"dir","Hash":"Qm...","Size":"24622"}\n'
  // Trim last \n, split entries by \n and then select the last which is the root directory
  const lastFileUnparsed = res.body.trim().split("\n").slice(-1)[0];
  if (!lastFileUnparsed) throw Error(`No files in response body ${res.body}`);

  // Parse the JSON and return the hash of the root directory
  const lastFile = JSON.parse(lastFileUnparsed);
  return `/ipfs/${lastFile.Hash}`;
}
