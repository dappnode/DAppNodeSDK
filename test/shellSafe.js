const shell = require("../src/utils/shell");

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

const shellSafe = cmd => shell(cmd).catch(() => {});
const rmSafe = path => shellSafe(`rm -r ${path}`);
const mkdirSafe = path => shellSafe(`mkdir -p ${path}`);

module.exports = {
  shellSafe,
  rmSafe,
  mkdirSafe
};
