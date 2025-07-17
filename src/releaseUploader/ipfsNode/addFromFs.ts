import { KuboRPCClient } from "kubo-rpc-client";
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

  let files: any;
  if (fs.statSync(dirOrFilePath).isDirectory()) {
    files = Array.from(getFiles(dirOrFilePath));
  } else {
    files = [
      {
        path: path.basename(dirOrFilePath),
        content: fs.createReadStream(dirOrFilePath)
      }
    ];
  }

  // Track progress
  let totalSize = 0;
  let uploadedSize = 0;
  for (const file of files) {
    const filePath = path.resolve(dirOrFilePath, file.path);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      totalSize += stat.size;
    } else {
      // Optionally log or handle missing files
      continue;
    }
  }

  // Add files to IPFS
  let lastCid = "";
  for await (const result of kuboClient.addAll(files, {
    wrapWithDirectory: true
  })) {
    lastCid = result.cid.toString();
    // Progress callback (approximate)
    if (onProgress && result.size) {
      uploadedSize += result.size;
      onProgress(Math.min(uploadedSize / totalSize, 1));
    }
  }
  if (!lastCid) throw Error("No CID returned from IPFS add");
  return `/ipfs/${lastCid}`;
}
