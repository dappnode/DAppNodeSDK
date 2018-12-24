const {readManifest, writeManifest} = require('../utils/manifest');
const {generateAndWriteCompose} = require('../utils/compose');
const semver = require('semver');
const check = require('../utils/check');
const checkSemverType = require('../utils/checkSemverType');

async function increaseFromLocalVersion({type, dir}) {
  // Check variables
  check(type, 'semver type');
  checkSemverType(type);

  // Load manifest
  const manifest = readManifest({dir});
  check(manifest, 'manifest', 'object');
  check(manifest.version, 'manifest version');
  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest({manifest, dir});
  generateAndWriteCompose({manifest, dir});

  return nextVersion;
}

module.exports = increaseFromLocalVersion;
