import { expect } from "chai";
import path from "path";
import { cleanTestDir, testDir } from "../../testUtils.js";
import { defaultComposeFileName, singleVariantName } from "../../../src/params.js";
import {
    writeManifest,
    readCompose,
    writeCompose,
    readManifest
} from "../../../src/files/index.js";
import { Manifest } from "@dappnode/types";
import { ManifestFormat } from "../../../src/files/manifest/types.js";
import {
    updateVariantFiles,
    updateVariantEntry
} from "../../../src/tasks/publish/subtasks/getUpdateFilesTask.js";
import { BuildVariantsMap } from "../../../src/types.js";


describe("Update Variant Files and Entries", function () {
    this.timeout(60 * 1000);

    const dnpName = "admin.dnp.dappnode.eth";
    const manifest: Manifest = {
        name: dnpName,
        version: "0.1.0",
        type: "dncore"
    };
    const nextVersion = "0.1.1";

    before("Clean testDir", () => cleanTestDir());
    after("Clean testDir", () => cleanTestDir());

    it("Should update manifest and compose files correctly", async () => {
        // Write initial manifest and compose files
        writeManifest(manifest, ManifestFormat.json, { dir: testDir });
        writeCompose(
            { version: "3.8", services: { [dnpName]: { image: `${dnpName}:${manifest.version}` } } },
            { dir: testDir }
        );

        // Update variant files
        updateVariantFiles({
            rootDir: testDir,
            composeFileName: defaultComposeFileName,
            variant: singleVariantName,
            variantsDirPath: testDir,
            dnpName,
            nextVersion
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

    it("Should update variant entry correctly", async () => {
        // Prepare the variants map
        const variantsMap: BuildVariantsMap = {
            [singleVariantName]: {
                manifest,
                manifestFormat: ManifestFormat.json,
                compose: readCompose([{ dir: testDir }]),
                releaseDir: testDir,
                composePaths: [path.join(testDir, defaultComposeFileName)],
                images: [],
                architectures: []
            }
        };

        // Update variant entry
        updateVariantEntry({
            variant: singleVariantName,
            rootDir: testDir,
            variantsDirPath: testDir,
            composeFileName: defaultComposeFileName,
            variantsMap
        });

        // Check that the variants map was updated correctly
        expect(variantsMap[singleVariantName].manifest.version).to.equal(
            nextVersion,
            "Variants map manifest version should be updated to the next version"
        );
        expect(variantsMap[singleVariantName].compose.services[dnpName].image).to.equal(
            `${dnpName}:${nextVersion}`,
            "Variants map compose image should be updated to the next version"
        );
    });
});
