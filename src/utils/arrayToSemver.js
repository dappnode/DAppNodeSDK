/**
 * Parses a semver version array from the APM format to its regular string format to the format
 * @param {Array} versionArray = [0, 1, 8]
 * @return {String} 0.1.8
 */
function arrayToSemver(versionArray) {
  return versionArray.join(".");
}

module.exports = arrayToSemver;
