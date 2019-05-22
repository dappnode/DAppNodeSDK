/**
 * Parses a semver version to the format necessary for an APM repo
 * @param {String} _semver = 0.1.8
 * @return {Array} [0, 1, 8]
 */
function semverToArray(_semver) {
  return _semver.split(".");
}

module.exports = semverToArray;
