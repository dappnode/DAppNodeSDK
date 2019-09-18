const processExit = require("./processExit");
const sizeOf = require("image-size");

const expectedSize = 300;

function verifyAvatar(avatarPath) {
  const { width, height } = sizeOf(avatarPath);

  if (width !== expectedSize || height !== expectedSize)
    processExit(
      "Wrong avatar size",
      `Avatar png must be ${expectedSize} x ${expectedSize} but it's ${width} x ${height}`
    );
}

module.exports = verifyAvatar;
