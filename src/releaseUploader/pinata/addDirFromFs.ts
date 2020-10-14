import got from "got";
import { getFormDataFileUpload } from "../utils/formDataFileUpload";
import { PinataMetadata, PinataOptions, IpfsUploadResult } from "./PinataSDK";

/**
 * Uploads a directory or file from the fs
 * @param dirOrFilePath "build_0.1.0/"
 * @param pinataUrl "https://api.pinata.cloud"
 * @param onProgress Reports upload progress, 0.4631
 * @returns "/ipfs/Qm..."
 */
export async function pinataAddFromFs({
  dirOrFilePath,
  pinataUrl,
  pinataMetadata,
  pinataOptions,
  credentials,
  onProgress
}: {
  dirOrFilePath: string;
  pinataUrl: string;
  credentials: { apiKey: string; secretApiKey: string };
  pinataMetadata?: PinataMetadata;
  pinataOptions?: PinataOptions;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  // Create form and append all files recursively
  const form = getFormDataFileUpload(dirOrFilePath);
  if (pinataMetadata)
    form.append("pinataMetadata", JSON.stringify(pinataMetadata));
  if (pinataOptions)
    form.append("pinataOptions", JSON.stringify(pinataOptions));

  let lastPercent = -1;
  const response = await got({
    prefixUrl: pinataUrl, // https://api.pinata.cloud
    url: "pinning/pinFileToIPFS",
    method: "POST",
    headers: form.getHeaders({
      pinata_api_key: credentials.apiKey,
      pinata_secret_api_key: credentials.secretApiKey
    }),
    body: form,
    responseType: "json"
  }).on("uploadProgress", progress => {
    // Report upload progress, and throttle to one update per percent point
    // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
    const currentRoundPercent = Math.round(100 * progress.percent);
    if (lastPercent !== currentRoundPercent) {
      lastPercent = currentRoundPercent;
      if (onProgress) onProgress(progress.percent);
    }
  });

  const uploadData = response.body as IpfsUploadResult;
  return `/ipfs/${uploadData.IpfsHash}`;
}
