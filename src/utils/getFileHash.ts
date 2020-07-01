import fs from "fs";
import crypto from "crypto";

/**
 * Hashes a file's buffer
 *
 * @param path
 * @return file's sha3 hash: 0x36d2fe6d4582e8cc1e5ea4c6c05e44bc94b88f4567edca12ba5fd5745796edef
 */
export function getFileHash(path: string): Promise<string | null> {
  return fs.promises
    .readFile(path)
    .then(data => {
      const hash = crypto.createHash("sha256");
      hash.update(data);
      return hash.digest("hex");
    })
    .catch(e => {
      if (e.code === "ENOENT") return null;
      else throw e;
    });
}
