const fs = require("fs");
const path = require("path");
const processExit = require("./processExit");

function getPathRootAvatar(dir) {
  const dirName = dir === "./" ? "root dir" : dir;

  const files = fs.readdirSync(dir);
  const pngFiles = files.filter(file => file.endsWith(".png"));

  if (pngFiles.length === 0) processExit(`No .png avatar found in ${dirName}`);
  if (pngFiles.length === 1) return path.join(dir, pngFiles[0]);

  const pngAvatarFiles = files.filter(file =>
    file.toLowerCase().includes("avatar")
  );
  if (pngAvatarFiles.length === 1) return path.join(dir, pngAvatarFiles[0]);

  processExit(
    `There are more than one .png in ${dirName}`,
    `Rename the target avatar as avatar-<packageName>.png`
  );
}

module.exports = getPathRootAvatar;
