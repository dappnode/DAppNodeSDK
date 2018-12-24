const expect = require('chai').expect;
const fs = require('fs');
const semver = require('semver');
const getNextVersionFromApm = require('../../src/methods/getNextVersionFromApm');

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to fetch the latest version from APM and log it

describe.skip('getNextVersionFromApm', () => {
  const manifest = {
    name: 'admin.dnp.dappnode.eth',
    version: '0.1.0',
  };
  const manifestPath = './dappnode_package.json';

  before(async () => {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  });

  it('Should get the last version from APM', async () => {
    const nextVersion = await getNextVersionFromApm({
      type: 'patch',
      ethProvider: 'infura',
    });
    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;
  }).timeout(20000);

  after(async () => {
    fs.unlinkSync(manifestPath);
  });
});
