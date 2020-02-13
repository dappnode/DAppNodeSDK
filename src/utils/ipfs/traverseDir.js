const path = require("path");
const fs = require("fs");

/**
 * Util that returns all files recursively in a given path
 * @param {string} dir "docs"
 * @return {string[]} ["docs/about.html", "docs/index.html"]
 */
function traverseDir(dir) {
  if (fs.lstatSync(dir).isDirectory()) {
    const filePaths = [];
    fs.readdirSync(dir).forEach(file => {
      const fullPath = path.join(dir, file);
      filePaths.push(...traverseDir(fullPath));
    });
    return filePaths;
  } else {
    return [dir];
  }
}

module.exports = traverseDir;
