import { expect } from "chai";
import semver from "semver";
import { cleanTestDir, generateCompose, testDir } from "../../testUtils.js";
import {
  defaultComposeFileName,
  defaultManifestFormat
} from "../../../src/params.js";
import {
  writeCompose,
  readCompose,
  writeManifest,
  readManifest
} from "../../../src/files/index.js";
import { Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../../src/files/manifest/types.js";
import { getNextPackageVersion } from "../../../src/tasks/publish/subtasks/getFetchApmVersionsTask.js";

describe("getNextPackageVersion", function () {
  this.timeout(60 * 1000);

  const dnpName = "admin.dnp.dappnode.eth";
  const manifest: Manifest = {
    name: dnpName,
    version: "0.1.0",
    type: "dncore"
  };

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should get the next version from APM and update manifest and compose files", async () => {
    // Write initial manifest and compose files
    writeManifest(manifest, ManifestFormat.json, { dir: testDir });
    writeCompose({ version: "3.8", services: { [dnpName]: { image: `${dnpName}:${manifest.version}` } } }, { dir: testDir });

    // Fetch the next version from APM
    const nextVersion = await getNextPackageVersion({
      manifest,
      releaseType: "patch",
      ethProvider: "infura"
    });

    // Ensure the next version is valid
    expect(semver.valid(nextVersion)).to.be.ok;
  });
});