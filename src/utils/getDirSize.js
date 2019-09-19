const path = require("path");
const fs = require("fs");

function getDirSize(dirPath) {
  let totalBytes = 0;
  for (const file of fs.readdirSync(dirPath)) {
    totalBytes += fs.statSync(path.join(dirPath, file)).size;
  }
  return totalBytes;
}

module.exports = getDirSize;
