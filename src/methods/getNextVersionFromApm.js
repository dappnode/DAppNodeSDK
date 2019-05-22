const { readManifest } = require("../utils/manifest");
const semver = require("semver");
const Apm = require("../utils/Apm");
const check = require("../utils/check");
const checkSemverType = require("../utils/checkSemverType");

async function getNextVersionFromApm({ type, ethProvider, dir }) {
  // Check variables
  check(type, "semver type");
  checkSemverType(type);

  // Init APM instance
  const apm = new Apm(ethProvider);

  // Load manifest
  const manifest = readManifest({ dir });
  check(manifest, "manifest", "object");
  check(manifest.name, "manifest name");
  const ensName = manifest.name.toLowerCase();

  // Fetch the latest version from APM
  const currentVersion = await apm.getLatestVersion(ensName);

  // Increase the version and log it
  const nextVersion = semver.inc(currentVersion, type);
  if (!nextVersion)
    throw Error(
      `Error computing next version, is this increase type correct? type: ${type}`
    );

  return nextVersion;
}

module.exports = getNextVersionFromApm;
