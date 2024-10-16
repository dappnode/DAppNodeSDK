import fs from "fs";
import crypto from "crypto";

/**
 * Hashes a file by reading it in chunks
 *
 * @param path
 * @return file's sha256 hash
 */
export function getFileHash(path: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(path);

    stream.on("data", (chunk: Buffer) => {
      hash.update(chunk); // Should now recognize Buffer correctly
    });

    stream.on("end", () => {
      const fileHash = hash.digest("hex");
      resolve(fileHash);
    });

    stream.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve(null); // file not found
      } else {
        reject(err); // other errors
      }
    });
  });
}
