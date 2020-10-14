import got from "got";
import FormData from "form-data";
import request from "request";
import { normalizeIpfsProvider } from "./ipfsProvider";

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

  for (const { filepath, url } of files) {
    // Using request instead of got, because got doesn't seem to work
    const fileStream = request(url);
    fileStream.on("data", chunk => {
      if (onProgress) onProgress(filepath, chunk.length);
    });
    form.append(`file-${filepath}`, fileStream, { filepath });
  }

  // Parse the ipfsProvider the a full base apiUrl
  const res = await got({
    prefixUrl: normalizeIpfsProvider(ipfsProvider),
    url: "api/v0/add",
    method: "POST",
    headers: form.getHeaders(),
    body: form
  });

  // res.body = '{"Name":"dir/file","Hash":"Qm...","Size":"2203"}\n{"Name":"dir","Hash":"Qm...","Size":"24622"}\n'
  // Trim last \n, split entries by \n and then select the last which is the root directory
  const lastFileUnparsed = res.body.trim().split("\n").slice(-1)[0];
  if (!lastFileUnparsed) throw Error(`No files in response body ${res.body}`);

  // Parse the JSON and return the hash of the root directory
  const lastFile = JSON.parse(lastFileUnparsed);
  return `/ipfs/${lastFile.Hash}`;
}
