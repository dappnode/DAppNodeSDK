import { expect } from "chai";
import { increaseFromLocalVersion } from "../../../src/utils/versions/increaseFromLocalVersion";
import {
  readCompose,
  writeCompose
} from "../../../src/validation/compose/compose";
import {
  readManifest,
  writeManifest
} from "../../../src/validation/manifest/manifest";
import { cleanTestDir, generateCompose, testDir } from "../../testUtils";
import {
  defaultComposeFileName,
  defaultManifestFormat
} from "../../../src/params";
import { Manifest } from "../../../src/types";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
//
// Then it will expect the function to
// - log the next version
// - modify the existing manifest and increase its version
// - generate a docker compose with the next version

describe("increaseFromLocalVersion", function () {
  this.timeout(60 * 1000);

  const dnpName = "admin.dnp.dappnode.eth";
  const manifest: Manifest = {
    name: dnpName,
    version: "0.1.0",
    avatar: "/ipfs/QmUG9Y13BvmKC4RzFu85F7Ai63emnEYrci4pqbbLxt3mt1",
    type: "dncore"
  };

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should get the last version from APM", async () => {
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });
    writeCompose(generateCompose(manifest), { dir: testDir });

    const nextVersion = await increaseFromLocalVersion({
      type: "patch",
      compose_file_name: defaultComposeFileName,
      dir: testDir
    });

    // Check that the console output contains a valid semver version
    expect(nextVersion).to.equal(
      "0.1.1",
      "Should output to console the next version"
    );

    // Check that the compose was edited correctly to the next version
    const compose = readCompose({ dir: testDir });
    expect(compose.services[dnpName].image).to.equal(
      "admin.dnp.dappnode.eth:0.1.1",
      "compose should be edited to the next version"
    );
    // Check that the manifest was edited correctly to the next version
    const { manifest: newManifest } = readManifest({ dir: testDir });
    expect(newManifest.version).to.equal(
      "0.1.1",
      "manifest should be edited to the next version"
    );
  });
});
