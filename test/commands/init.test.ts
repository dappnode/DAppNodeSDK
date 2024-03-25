import { expect } from "chai";
import fs from "fs";
import path from "path";
import { initHandler } from "../../src/commands/init/index.js";
import { cleanTestDir, testDir } from "../testUtils.js";
import {
    defaultVersion,
    publicRepoDomain,
    avatarPath,
    dockerfilePath,
} from "../../src/commands/init/index.js";

describe("Init command content validation", function () {
    this.timeout(120 * 1000); // Adjust timeout as needed

    describe("Non-template repository", function () {
        before(async () => {
            cleanTestDir();
            await initHandler({
                dir: testDir,
                force: true,
                yes: true,
                template: false,
            });
        });

        after(() => {
            cleanTestDir();
        });

        it("should have the correct avatar file", function () {
            const avatarFilePath = path.join(testDir, avatarPath);
            expect(fs.existsSync(avatarFilePath)).to.be.true;
        });

        it("should have a valid Dockerfile", function () {
            const dockerFilePath = path.join(testDir, dockerfilePath);
            const content = fs.readFileSync(dockerFilePath, "utf8");
            expect(content).to.include("FROM busybox");
        });

        it("should have the correct dappnode_package.json", function () {
            const manifestPath = path.join(testDir, "dappnode_package.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            expect(manifest.name).to.equal(`dappnodesdk${publicRepoDomain}`);
            expect(manifest.version).to.equal(defaultVersion);
        });

        it("should have the correct docker-compose.yml", function () {
            const composePath = path.join(testDir, "docker-compose.yml");
            const content = fs.readFileSync(composePath, "utf8");
            expect(content).to.include('version: "3.5"');
            expect(content).to.include('restart: unless-stopped');
        });
    });

    describe("Template repository", function () {
        before(async () => {
            cleanTestDir();
            await initHandler({
                dir: testDir,
                force: true,
                yes: true,
                template: true,
            });
        });

        after(() => {
            cleanTestDir();
        });

        // Repeating the avatar and Dockerfile tests is unnecessary as it does not differ 
        // between template and non-template inits.

        const variants = ["mainnet", "testnet"];
        variants.forEach((variant) => {
            it(`should have a correctly named dappnode_package.json for ${variant} variant`, function () {
                const manifestPath = path.join(testDir, "package_variants", variant, "dappnode_package.json");
                const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
                expect(manifest.name).to.equal(`dappnodesdk-${variant}${publicRepoDomain}`);
                expect(manifest.version).to.equal(defaultVersion);
            });

            it(`should set the NETWORK environment variable correctly in ${variant} variant's docker-compose.yml`, function () {
                const composePath = path.join(testDir, "package_variants", variant, "docker-compose.yml");
                const content = fs.readFileSync(composePath, "utf8");
                expect(content).to.include(`NETWORK: ${variant}`);
            });
        });
    });
});
