import { KuboRPCClient, ImportCandidate, AwaitIterable } from "kubo-rpc-client";
import fs from "fs";
import path from "path";

/**
 * Uploads a directory or file from the fs
 * @param dirOrFile "docs"
 * @param ipfsProvider "dappnode" | "http://localhost:5001"
 * @param onProgress Report upload progress, 0.4631
 * @returns "/ipfs/Qm..."
 */
export async function ipfsAddFromFs(
  dirOrFilePath: string,
  kuboClient: KuboRPCClient,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Calculate total size of all files before upload
  function* getStatFiles(dir: string): Generator<string> {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(dir)) {
        yield* getStatFiles(path.join(dir, entry));
      }
    } else {
      yield dir;
    }
  }

  let totalSize = 0;
  if (fs.statSync(dirOrFilePath).isDirectory()) {
    for (const filePath of getStatFiles(dirOrFilePath)) {
      totalSize += fs.statSync(filePath).size;
    }
  } else {
    totalSize = fs.statSync(dirOrFilePath).size;
  }
  // Helper to recursively collect files from a directory
  function* getFiles(
    dir: string
  ): Generator<{ path: string; content: fs.ReadStream }> {
    const stat = fs.statSync(dir);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(dir)) {
        yield* getFiles(path.join(dir, entry));
      }
    } else {
      yield {
        path: path.relative(path.dirname(dirOrFilePath), dir),
        content: fs.createReadStream(dir)
      };
    }
  }

  let files: AwaitIterable<ImportCandidate>;
  if (fs.statSync(dirOrFilePath).isDirectory()) {
    files = getFiles(dirOrFilePath);
  } else {
    files = (function* () {
      yield {
        path: path.basename(dirOrFilePath),
        content: fs.createReadStream(dirOrFilePath)
      };
    })();
  }

  // Add files to IPFS
  let lastCid = "";
  let uploaded = 0;
  for await (const result of kuboClient.addAll(files, {
    wrapWithDirectory: true,
    progress: (bytes: number) => {
      uploaded = bytes;
      if (onProgress && totalSize > 0) {
        onProgress(Math.min(uploaded / totalSize, 1));
      }
    }
  })) {
    lastCid = result.cid.toString();
  }
  if (!lastCid) throw Error("No CID returned from IPFS add");
  return `/ipfs/${lastCid}`;
}
