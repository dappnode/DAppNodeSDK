import fs from "fs";
import rimraf from "rimraf";

export const testDir = "test_files";
export function cleanTestDir(): void {
  rimraf.sync(testDir);
  fs.mkdirSync(testDir, { recursive: true });
}
