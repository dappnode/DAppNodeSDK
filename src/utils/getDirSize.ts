import fs from "fs";
import path from "path";

export function getDirSize(dirPath: string) {
  let totalBytes = 0;
  for (const file of fs.readdirSync(dirPath)) {
    totalBytes += fs.statSync(path.join(dirPath, file)).size;
  }
  return totalBytes;
}
