const { readManifest, writeManifest } = require("../manifest");
const { updateCompose } = require("../compose");
const check = require("../check");
const getNextVersionFromApm = require("./getNextVersionFromApm");

async function increaseFromApmVersion({ type, ethProvider, dir }) {
  // Check variables
  const nextVersion = await getNextVersionFromApm({ type, ethProvider, dir });

  // Load manifest
  const manifest = readManifest({ dir });
  check(manifest, "manifest", "object");

  // Increase the version
  manifest.version = nextVersion;

  // Mofidy and write the manifest and docker-compose
  writeManifest({ manifest, dir });
  const { name, version } = manifest;
  updateCompose({ name, version, dir });

  return nextVersion;
}

module.exports = increaseFromApmVersion;
