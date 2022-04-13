import { expect } from "chai";
import semver from "semver";
import { increaseFromApmVersion } from "../../../src/utils/versions/increaseFromApmVersion";
import { cleanTestDir, generateCompose, testDir } from "../../testUtils";
import { writeReleaseFile } from "../../../src/releaseFiles/writeReleaseFile";
import {
  defaultComposeFileName,
  defaultManifestFormat
} from "../../../src/params";
import { readReleaseFile } from "../../../src/releaseFiles/readReleaseFile";
import { Manifest } from "../../../src/releaseFiles/manifest/types";
import {
  ReleaseFileType,
  AllowedFormats
} from "../../../src/releaseFiles/types";

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
    writeReleaseFile(
      { type: ReleaseFileType.manifest, data: manifest },
      defaultManifestFormat,
      {
        dir: testDir
      }
    );
    writeReleaseFile(
      { type: ReleaseFileType.compose, data: generateCompose(manifest) },
      AllowedFormats.yml,
      {
        dir: testDir
      }
    );

    const nextVersion = await increaseFromApmVersion({
      type: "patch",
      ethProvider: "infura",
      composeFileName: defaultComposeFileName,
      dir: testDir
    });

    // Check that the console output contains a valid semver version
    expect(semver.valid(nextVersion)).to.be.ok;

    // Check that the compose was edited correctly to the next version
    const compose = readReleaseFile(ReleaseFileType.compose, { dir: testDir });
    expect(compose.data.services[dnpName].image).to.equal(
      `admin.dnp.dappnode.eth:${nextVersion}`,
      "compose should be edited to the next version"
    );
    // Check that the manifest was edited correctly to the next version
    const newManifest = readReleaseFile(ReleaseFileType.manifest, {
      dir: testDir
    });
    expect(newManifest.data.version).to.equal(
      nextVersion,
      "manifest should be edited to the next version"
    );
  });
});
