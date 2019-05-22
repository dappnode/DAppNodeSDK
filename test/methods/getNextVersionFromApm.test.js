const expect = require("chai").expect;
const fs = require("fs");
const semver = require("semver");
const rmSafe = require("../rmSafe");
const getNextVersionFromApm = require("../../src/methods/getNextVersionFromApm");

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to fetch the latest version from APM and log it

describe("getNextVersionFromApm", () => {
  const manifest = {
    name: "admin.dnp.dappnode.eth",
    version: "0.1.0"
  };
  const manifestPath = "./dappnode_package.json";

  before(async () => {
    await rmSafe(manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  });

  it("Should get the last version from APM", async () => {
    const nextVersion = await getNextVersionFromApm({
      type: "patch",
      ethProvider: "infura"
    });
    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;
  }).timeout(60 * 1000);

  after(async () => {
    await rmSafe(manifestPath);
  });
});
