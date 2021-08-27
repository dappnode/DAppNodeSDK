import { expect } from "chai";
import semver from "semver";
import { increaseFromApmVersion } from "../../../src/utils/versions/increaseFromApmVersion";
import { Manifest } from "../../../src/types";
import { cleanTestDir, generateCompose, testDir } from "../../testUtils";
import { readManifest, writeManifest } from "../../../src/utils/manifest";
import { readCompose, writeCompose } from "../../../src/utils/compose";
import {
  defaultComposeFileName,
  defaultManifestFormat
} from "../../../src/params";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to
// - log the next version
// - modify the existing manifest and increase its version
// - generate a docker compose with the next version

describe("increaseFromApmVersion", function () {
  this.timeout(60 * 1000);

  const dnpName = "admin.dnp.dappnode.eth";
  const manifest: Manifest = {
    name: dnpName,
    version: "0.1.0",
    type: "dncore"
  };

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should get the last version from APM", async () => {
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });
    writeCompose(generateCompose(manifest), { dir: testDir });

    const nextVersion = await increaseFromApmVersion({
      type: "patch",
      ethProvider: "infura",
      composeFileName: defaultComposeFileName,
      dir: testDir
    });

    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;

    // Check that the compose was edited correctly to the next version
    const compose = readCompose({ dir: testDir });
    expect(compose.services[dnpName].image).to.equal(
      `admin.dnp.dappnode.eth:${nextVersion}`,
      "compose should be edited to the next version"
    );
    // Check that the manifest was edited correctly to the next version
    const { manifest: newManifest } = readManifest({ dir: testDir });
    expect(newManifest.version).to.equal(
      nextVersion,
      "manifest should be edited to the next version"
    );
  });
});
