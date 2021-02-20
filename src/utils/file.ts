import fs from "fs";

/**
 * fs.readFileSync with nicer error message
 */
export function readFile(filepath: string): string {
  // Recommended way of checking a file existance https://nodejs.org/api/fs.html#fs_fs_exists_path_callback
  try {
    return fs.readFileSync(filepath, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      throw Error(
        `${filepath} not found. Make sure you are in a directory with an initialized DNP.`
      );
    } else {
      throw e;
    }
  }
}
