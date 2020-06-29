import fs from "fs";
import path from "path";

/**
 * Util that returns all files recursively in a given path
 * @param dir "docs"
 * @return ["docs/about.html", "docs/index.html"]
 */
export function traverseDir(dir: string): string[] {
  if (fs.lstatSync(dir).isDirectory()) {
    const filePaths: string[] = [];
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      filePaths.push(...traverseDir(fullPath));
    });
    return filePaths;
  } else {
    return [dir];
  }
}
