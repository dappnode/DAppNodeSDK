import { got, type Request } from "got";
import { uploadTimeout } from "../utils/uploadTimeout.js";
import FormData from "form-data";
import { PassThrough } from "stream";
import { normalizeIpfsProvider } from "./ipfsProvider.js";

/**
 * Streams a list of file download urls, uploading them to IPFS as a directory
 * @param files [{filepath: "doc/index.html", url: "http://serve.io/index.html"}]
 * @param ipfsProvider "dappnode" | "http://localhost:5001"
 * @param onProgress Report upload progress, by received chunk length
 * @returns "/ipfs/Qm..."
 */
export async function ipfsAddDirFromUrls(
  files: { filepath: string; url: string }[],
  ipfsProvider: string,
  onProgress?: (filepath: string, bytes: number) => void
): Promise<string> {
  // Create form and append all files recursively
  const form = new FormData();

  const streams: Request[] = [];
  for (const { filepath, url } of files) {
    const fileStream = got.stream(url, { retry: { limit: 0 } });
    streams.push(fileStream);
    fileStream.on("data", chunk => {
      if (onProgress) onProgress(filepath, chunk.length);
    });
    form.append(`file-${filepath}`, fileStream, { filepath });
  }

  // Parse the ipfsProvider the a full base apiUrl
  const body = new PassThrough();
  form.on("error", error => body.destroy(error));
  const upload = got({
    prefixUrl: normalizeIpfsProvider(ipfsProvider),
    url: "api/v0/add",
    method: "POST",
    headers: form.getHeaders(),
    body,
    timeout: uploadTimeout,
    retry: { limit: 0 },
    http2: true
  });

  form.pipe(body);
  const res = await upload.finally(() => {
    for (const stream of streams) stream.destroy();
    form.destroy();
    body.destroy();
  });

  // res.body = '{"Name":"dir/file","Hash":"Qm...","Size":"2203"}\n{"Name":"dir","Hash":"Qm...","Size":"24622"}\n'
  // Trim last \n, split entries by \n and then select the last which is the root directory
  const lastFileUnparsed = res.body.trim().split("\n").slice(-1)[0];
  if (!lastFileUnparsed) throw Error(`No files in response body ${res.body}`);

  // Parse the JSON and return the hash of the root directory
  const lastFile = JSON.parse(lastFileUnparsed);
  return `/ipfs/${lastFile.Hash}`;
}
