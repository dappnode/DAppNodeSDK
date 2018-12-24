
// Valid increase types from https://www.npmjs.com/package/semver
const validIncreaseTypes = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

function checkSemverType(type) {
  if (!validIncreaseTypes.includes(type)) {
    throw Error(`Semver increase type "${type}" is not valid. Must be one of: ${validIncreaseTypes.join(', ')}`);
  }
}

module.exports = checkSemverType;
