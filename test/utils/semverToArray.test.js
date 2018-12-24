const expect = require('chai').expect;
const semverToArray = require('../../src/utils/semverToArray');
const arrayToSemver = require('../../src/utils/arrayToSemver');

describe('semver to array conversions', () => {
  const semver = '0.1.5';
  let versionArray;

  it('should convert a semver version to array', () => {
    versionArray = semverToArray(semver);
    expect(versionArray).to.deep.equal(['0', '1', '5']);
  });

  it('should convert a version array to semver', () => {
    const _semver = arrayToSemver(versionArray);
    expect(_semver).to.equal(semver);
  });
});
