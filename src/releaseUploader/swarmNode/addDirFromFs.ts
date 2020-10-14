import tarFS from "tar-fs";
import got from "got";

/**
 * @returns Resulting hash: "/bzz/a5e0183cee00112..."
 */
export async function swarmAddDirFromFs(
  dirPath: string,
  gatewayUrl: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const res = await got({
    prefixUrl: gatewayUrl,
    url: "/bzz:/",
    method: "POST",
    headers: { "content-type": "application/x-tar" },
    body: tarFS.pack(dirPath)
  }).on("uploadProgress", progress => {
    // Report upload progress
    // { percent: 0.9995998225975282, transferred: 733675762, total: 733969480 }
    if (onProgress) onProgress(progress.percent);
  });

  const rootHash = res.body;
  return `/bzz/${rootHash}`;
}
