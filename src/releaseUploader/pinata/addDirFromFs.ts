import got from "got";
import { getFormDataFileUpload } from "../utils/formDataFileUpload";
import { PinataMetadata } from "./PinataSDK";

/**
 * Uploads a directory or file from the fs
 * @param dirOrFilePath "build_0.1.0/"
 * @param pinataUrl "https://api.pinata.cloud"
 * @param onProgress Reports upload progress, 0.4631
 * @returns "/ipfs/Qm..."
 */
export async function pinataAddFromFs(
  dirOrFilePath: string,
  pinataUrl: string,
  metadata: PinataMetadata,
  credentials: { apiKey: string; secretApiKey: string },
  onProgress?: (percent: number) => void
): Promise<string> {
  // Create form and append all files recursively
  const form = getFormDataFileUpload(dirOrFilePath);
  form.append("pinataMetadata", metadata);

  let lastPercent = -1;
  const res = await got({
    prefixUrl: pinataUrl, // https://api.pinata.cloud
    url: "pinning/pinFileToIPFS",
    method: "POST",
    headers: form.getHeaders({
      pinata_api_key: credentials.apiKey,
      pinata_secret_api_key: credentials.secretApiKey
    }),
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
