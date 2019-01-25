const path = require('path');
const fs = require('fs');

// Local cache specs. Path = "DAppNodeSDK/.cache"
// <key> <value>
// <image-id 1> <tar.xz hash 1>
// <image-id 2> <tar.xz hash 2>
// sha256:0d31e5521ef6e92a0efb6110024da8a3517daac4b1e4bbbccaf063ce96641b1b 0x36d2fe6d4582e8cc1e5ea4c6c05e44bc94b88f4567edca12ba5fd5745796edef

const cachePath = path.resolve(__dirname, '../../.cache');

function loadCache() {
  try {
    const cacheString = fs.readFileSync(cachePath, 'utf8');
    return cacheString.trim().split('\n').reduce((obj, row) => {
      const [key, value] = row.split(' ');
      obj[key] = value;
      return obj;
    }, {});
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    else throw e;
  }
}

function writeCache({key, value}) {
  const cache = loadCache();
  cache[key] = value;
  const cacheString = Object.keys(cache).map((key) => `${key} ${cache[key]}`).join('\n');
  fs.writeFileSync(cachePath, cacheString);
}

module.exports = {
  load: loadCache,
  write: writeCache,
};
