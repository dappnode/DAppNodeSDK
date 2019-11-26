const { readManifest, writeManifest } = require("../manifest");
const { updateCompose } = require("../compose");
const semver = require("semver");
const check = require("../check");
const checkSemverType = require("../checkSemverType");

async function increaseFromLocalVersion({ type, dir }) {
  // Check variables
  check(type, "semver type");
  checkSemverType(type);

  // Load manifest
  const manifest = readManifest({ dir });
  check(manifest, "manifest", "object");
  check(manifest.version, "manifest version");

  const currentVersion = manifest.version;

  // Increase the version
  const nextVersion = semver.inc(currentVersion, type);
  manifest.version = nextVersion;

  if (manifest.image) {
    // Only on manifest type release
    // Reset the image path, hash, and size fields.
    // They no longer represent the increased version
    check(manifest.image, "manifest image", "object");
    manifest.image.path = "";
    manifest.image.hash = "";
    manifest.image.size = "";
  }

  // Mofidy and write the manifest and docker-compose
  writeManifest({ manifest, dir });
  const { name, version } = manifest;
  updateCompose({ name, version, dir });

  return nextVersion;
}

module.exports = increaseFromLocalVersion;
