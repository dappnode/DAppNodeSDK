import { expect } from "chai";
import { Manifest } from "@dappnode/types";
import { ManifestFormat, ManifestPaths } from "../../../src/files/manifest/types";
import { readManifest } from "../../../src/files/index.js";
import path from "path";
import fs from "fs";
import { cleanTestDir, testDir } from "../../testUtils.js";

describe("files / compose / readManifest", () => {
    before(() => {
        cleanTestDir(); // Clean up the test directory before each test
    });

    after(() => {
        cleanTestDir(); // Clean up the test directory after all tests are done
    });

    it("Should read and merge multiple manifest files", () => {
        const manifestPaths: ManifestPaths[] = [
            { dir: testDir, manifestFileName: "manifest1.json" },
            { dir: testDir, manifestFileName: "manifest2.json" },
            { dir: testDir, manifestFileName: "manifest3.json" }
        ];

        const manifest1: Partial<Manifest> = { name: "test" };
        const manifest2: Partial<Manifest> = { version: "1.0.0" };
        const manifest3: Partial<Manifest> = { author: "tester" };

        // Create test files
        fs.writeFileSync(path.join(testDir, "manifest1.json"), JSON.stringify(manifest1));
        fs.writeFileSync(path.join(testDir, "manifest2.json"), JSON.stringify(manifest2));
        fs.writeFileSync(path.join(testDir, "manifest3.json"), JSON.stringify(manifest3));

        // Call readManifest function
        const { manifest, format } = readManifest(manifestPaths);

        // Expected merged manifest
        const expectedManifest = {
            ...manifest1,
            ...manifest2,
            ...manifest3
        };

        // Assertions
        expect(format).to.equal(ManifestFormat.json);
        expect(manifest).to.deep.equal(expectedManifest);
    });
});
