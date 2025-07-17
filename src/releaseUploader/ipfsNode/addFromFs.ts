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
      const size = fs.statSync(filePath).size;
      totalSize += size;
      console.log(`[IPFS-UPLOAD] File: ${filePath}, Size: ${size}`);
    }
  } else {
    totalSize = fs.statSync(dirOrFilePath).size;
    console.log(
      `[IPFS-UPLOAD] Single file: ${dirOrFilePath}, Size: ${totalSize}`
    );
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
  console.log(`[IPFS-UPLOAD] Starting upload. Total size: ${totalSize}`);
  for await (const result of kuboClient.addAll(files, {
    wrapWithDirectory: true
  })) {
    lastCid = result.cid.toString();
    uploaded += result.size || 0;
    const percent = totalSize > 0 ? Math.min(uploaded / totalSize, 1) : 0;
    console.log(
      `[IPFS-UPLOAD] Uploaded chunk. CID: ${lastCid}, Path: ${result.path}, Size: ${result.size}`
    );
    console.log(
      `[IPFS-UPLOAD] Progress: ${uploaded} bytes uploaded (${(
        percent * 100
      ).toFixed(2)}%)`
    );
    if (onProgress && totalSize > 0) {
      onProgress(percent);
    }
  }
  if (!lastCid) throw Error("No CID returned from IPFS add");
  return `/ipfs/${lastCid}`;
}
