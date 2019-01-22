const {promisify} = require('util');
const fs = require('fs');
const web3Utils = require('web3-utils');

/**
 * Hashes a file's buffer
 *
 * @param {String} path
 * @return {String} file's sha3 hash: 0x36d2fe6d4582e8cc1e5ea4c6c05e44bc94b88f4567edca12ba5fd5745796edef
 */
function getFileHash(path) {
  return promisify(fs.readFile)(path)
      .then(web3Utils.sha3)
      .catch((e) => {
        if (e.code === 'ENOENT') return null;
        else throw e;
      });
}

module.exports = getFileHash;
