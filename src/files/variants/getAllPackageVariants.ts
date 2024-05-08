import fs from "fs";

/**
 * Reads all directory names (variants) within a given path.
 * @param {string} packageVariantsPath The path where to look for directories.
 * @returns {string[]} An array of directory names (variants) found in the given path.
 */
export function getAllVariantsInPath(packageVariantsPath: string): string[] {
  try {
    const items = fs.readdirSync(packageVariantsPath, { withFileTypes: true });
    return items.filter(item => item.isDirectory()).map(dir => dir.name);
  } catch (error) {
    console.error(
      `Error reading directory names (variants) in path: ${packageVariantsPath}`,
      error
    );
    throw error;
  }
}
