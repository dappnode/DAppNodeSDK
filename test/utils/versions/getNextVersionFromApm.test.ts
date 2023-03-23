import { expect } from "chai";
import semver from "semver";
import { getNextVersionFromApm } from "../../../src/utils/versions/getNextVersionFromApm.js";
import { writeManifest } from "../../../src/files.js";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { defaultManifestFormat } from "../../../src/params.js";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to fetch the latest version from APM and log it

describe("getNextVersionFromApm", function () {
  this.timeout(60 * 1000);

  const manifest = {
    name: "admin.dnp.dappnode.eth",
    version: "0.1.0"
  };

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should get the last version from APM", async () => {
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });

    const nextVersion = await getNextVersionFromApm({
      type: "patch",
      ethProvider: "infura",
      dir: testDir
    });
    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;
  });
});
