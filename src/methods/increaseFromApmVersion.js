const {readManifest, writeManifest} = require('../utils/manifest');
const {generateAndWriteCompose} = require('../utils/compose');
const check = require('../utils/check');
const getNextVersionFromApm = require('../methods/getNextVersionFromApm');

async function increaseFromApmVersion({type, ethProvider, dir}) {
  // Check variables
  const nextVersion = await getNextVersionFromApm({type, ethProvider, dir});

  // Load manifest
  const manifest = readManifest({dir});
  check(manifest, 'manifest', 'object');

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest({manifest, dir});
  generateAndWriteCompose({manifest, dir});

  return nextVersion;
}

module.exports = increaseFromApmVersion;
