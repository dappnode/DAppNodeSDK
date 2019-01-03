const shell = require('../src/utils/shell');

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

const rmSafe = (path) => shell(`rm -r ${path}`).catch(() => {});

module.exports = rmSafe;
