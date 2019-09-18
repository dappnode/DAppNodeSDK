const verifyAvatar = require("./verifyAvatar");
const getPathRootAvatar = require("./getPathRootAvatar");

function getPathRootAvatarAndVerify(dir) {
  const avatarPath = getPathRootAvatar(dir);
  verifyAvatar(avatarPath);
  return avatarPath;
}

module.exports = getPathRootAvatarAndVerify;
