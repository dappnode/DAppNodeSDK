import { expect } from "chai";
import path from "path";
import { initHandler } from "../../src/commands/init/handler.js";
import { cleanTestDir, readTestFile, testDir, testPathExists } from "../testUtils.js";
import { dockerfileData, dockerfileName, gitignoreData, gitignoreName } from "../../src/commands/init/params.js";
import { defaultComposeFileName, defaultManifestFileName, defaultVariantsDirName, defaultVariantsEnvValues } from "../../src/params.js";

describe("Init simple package repository", function () {
    this.timeout(120 * 1000);

    before("Clean testDir", () => cleanTestDir());
    after("Clean testDir", () => cleanTestDir());

    before("Init repo", async () => {
        await initHandler({
            dir: testDir,
            force: true,
            yes: true,
            use_variants: false
        });
    });

    describe("File creation", () => {
        it("should create a Dockerfile", () => {
            expect(testPathExists(dockerfileName)).to.be.true;
        });

        it("should create a Dappnode manifest", () => {
            expect(testPathExists(defaultManifestFileName)).to.be.true;

        });

        it("should create a docker-compose.yml", () => {
            expect(testPathExists("docker-compose.yml")).to.be.true;
        });

        it("should create a .gitignore", () => {
            expect(testPathExists(".gitignore")).to.be.true;
        });
    });

    describe("Correct file content", () => {
        it("checks Dockerfile content", () => {
            expect(readTestFile(dockerfileName)).to.include(dockerfileData);
        });

        it("checks .gitignore content", () => {
            expect(readTestFile(gitignoreName)).to.include(gitignoreData);
        });

        it("checks manifest content for correct initialization", () => {
            const manifestContent = JSON.parse(readTestFile(defaultManifestFileName));
            expect(manifestContent.name).to.exist;
            expect(manifestContent.version).to.exist;
        });

        it("checks compose file for service configuration", () => {
            expect(readTestFile(defaultComposeFileName)).to.include("services:");
        });
    });
});

describe("Variant initialization", function () {
    this.timeout(120 * 1000);

    before("Clean testDir", () => cleanTestDir());
    after("Clean testDir", () => cleanTestDir());

    before("Init package repo with variants", async () => {
        await initHandler({
            dir: testDir,
            force: true,
            yes: true,
            use_variants: true
        });
    });

    it("should create variant directories", () => {
        expect(testPathExists(defaultVariantsDirName)).to.be.true;
    });

    it("checks for specific variant manifest", () => {
        const variantManifestPath = path.join(defaultVariantsDirName, defaultVariantsEnvValues[0], defaultManifestFileName);
        const rootManifestContent = JSON.parse(readTestFile(defaultManifestFileName));
        const variantManifestContent = JSON.parse(readTestFile(variantManifestPath));
        expect(rootManifestContent.name).to.not.exist;
        expect(variantManifestContent.name).to.exist;
        expect(rootManifestContent.version).to.not.exist;
        expect(variantManifestContent.version).to.exist;
    });
});