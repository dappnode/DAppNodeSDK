const shell = require("../src/utils/shell");

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

const mkdirSafe = path => shell(`mkdir -p ${path}`).catch(() => {});

module.exports = mkdirSafe;
