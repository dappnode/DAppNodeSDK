import { expect } from "chai";
import { cleanTestDir, testDir } from "../testUtils.js";
import { defaultVersion, initHandler, publicRepoDomain } from "../../src/commands/init/index.js";
import { buildHandler } from "../../src/commands/build.js";
import path from "path";
import fs from "fs";
import { defaultVariants } from "../../src/commands/init/params.js";

const contentProvider = "http://api.ipfs.dappnode.io:5001";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe("Init and build", function () {
  this.timeout(120 * 1000);

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  before("Init repo", async () => {
    await initHandler({
      dir: testDir,
      force: true,
      yes: true,
      template: false
    });
  });

  it("Should build and upload the current version", async () => {
    const buildResults = await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true
    });

    // Only one result should be returned
    if (buildResults.length > 1)
      throw new Error("More than one build result returned in a non-template repo build");

    const buildDir = fs.readdirSync(path.join(testDir, `build_${buildResults[0].dnpName}_${defaultVersion}`));

    // Check that build dir includes at least 1 .tar.xz file
    const tarFiles = buildDir.filter(file => file.endsWith(".tar.xz"));
    expect(tarFiles.length).to.be.greaterThan(0);

    expect(buildResults[0].releaseMultiHash).to.include("/ipfs/Qm");
    expect(buildResults[0].dnpName).to.equal(`dappnodesdk${publicRepoDomain}`);

  });
});

describe("Init and build template repo", function () {
  this.timeout(120 * 1000);

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  before("Init repo", async () => {
    await initHandler({
      dir: testDir,
      force: true,
      yes: true,
      template: true
    });
  });

  it("Should build and upload the current version", async () => {
    const buildResults = await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true,
      all_variants: true
    });

    expect(buildResults.length).to.equal(defaultVariants.length);

    // Check that all variants have their dnpName
    defaultVariants.forEach((variant) => {
      const buildResult = buildResults.find(result => result.dnpName === `dappnodesdk-${variant}${publicRepoDomain}`);
      expect(buildResult).to.not.be.undefined;
    });

    buildResults.forEach((result) => {
      expect(result.releaseMultiHash).to.include("/ipfs/Qm");

      const buildDir = fs.readdirSync(path.join(testDir, `build_${result.dnpName}_${defaultVersion}`));

      const tarFiles = buildDir.filter(file => file.endsWith(".tar.xz"));
      expect(tarFiles.length).to.be.greaterThan(0);
    });
  });
});