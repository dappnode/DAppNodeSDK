import tarFS from "tar-fs";
import { uploadTimeout } from "../utils/uploadTimeout.js";
import { got } from "got";

/**
 * @returns Resulting hash: "/bzz/a5e0183cee00112..."
 */
export async function swarmAddDirFromFs(
  dirPath: string,
  gatewayUrl: string,
  onProgress?: (percent: number) => void,
  onUploadComplete?: () => void
): Promise<string> {
  const res = await got({
    prefixUrl: gatewayUrl,
    url: "bzz:/",
    method: "POST",
    headers: { "content-type": "application/x-tar" },
    body: tarFS.pack(dirPath),
    timeout: uploadTimeout,
    retry: { limit: 0 }
  }).on("uploadProgress", progress => {
    // Report upload progress
    // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
    if (onProgress) onProgress(progress.percent);
    if (progress.percent === 1) onUploadComplete?.();
  });

  const rootHash = res.body;
  return `/bzz/${rootHash}`;
}
