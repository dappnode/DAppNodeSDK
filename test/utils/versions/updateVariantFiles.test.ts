import { expect } from "chai";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { defaultComposeFileName } from "../../../src/params.js";
import {
    writeManifest,
    readCompose,
    writeCompose,
    readManifest
} from "../../../src/files/index.js";
import { Compose, Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../../src/files/manifest/types.js";
import { updateVariantFiles, } from "../../../src/tasks/publish/subtasks/getUpdateFilesTask.js";


describe("Update Variant Files and Entries", function () {
    this.timeout(60 * 1000);

    const dnpName = "admin.dnp.dappnode.eth";

    const manifest: Manifest = {
        name: dnpName,
        version: "0.1.0",
        type: "dncore"
    };

    const compose: Compose = {
        version: "3.8",
        services: { [dnpName]: { image: "override-me" } }
    };

    const nextVersion = "0.1.1";

    before("Clean testDir", () => cleanTestDir());
    after("Clean testDir", () => cleanTestDir());

    it("Should update manifest and compose files correctly for a single variant package", async () => {
        // Write initial manifest and compose files
        writeManifest(manifest, ManifestFormat.json, { dir: testDir });
        writeCompose(compose, { dir: testDir });

        // Update variant files
        updateVariantFiles({
            rootDir: testDir,
            composeFileName: defaultComposeFileName,
            variant: null,
            variantsDirPath: testDir,
            dnpName,
            nextVersion,
        });

        // Check that the manifest was updated correctly
        const { manifest: newManifest } = readManifest([{ dir: testDir }]);
        expect(newManifest.version).to.equal(nextVersion, "Manifest version should be updated to the next version");

        // Check that the compose was updated correctly
        const updatedCompose = readCompose([{ dir: testDir, composeFileName: defaultComposeFileName }]);
        expect(updatedCompose.services[dnpName].image).to.equal(
            `${dnpName}:${nextVersion}`,
            "Compose image should be updated to the next version"
        );
    });
});
