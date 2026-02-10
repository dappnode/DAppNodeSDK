import fs from "fs";
import path from "path";
import { expect } from "chai";
import { cleanTestDir, testDir } from "../testUtils.js";
import { initHandler } from "../../src/commands/init/handler.js";
import { buildHandler } from "../../src/commands/build/handler.js";
import {
  defaultVariantsDirName,
  defaultVariantsEnvValues
} from "../../src/params.js";
import { normalizeIpfsProvider } from "../../src/releaseUploader/ipfsNode/ipfsProvider.js";

const contentProvider = await normalizeIpfsProvider("remote");

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe("Init and build simple package", function () {
  this.timeout(120 * 1000);

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  before("Init repo", async () => {
    await initHandler({
      dir: testDir,
      force: true,
      yes: true
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

    const releaseHashes = Object.entries(buildResults).flatMap(
      ([, { releaseMultiHash }]) => releaseMultiHash
    );

    expect(releaseHashes).to.have.lengthOf(1);

    // Check returned hash is correct
    expect(releaseHashes[0]).to.include("/ipfs/Qm");
  });
});

describe("Init and build package variants", function () {
  this.timeout(120 * 1000);

  beforeEach("Clean testDir", () => cleanTestDir());
  afterEach("Clean testDir", () => cleanTestDir());

  beforeEach("Init multi-variant repo", async () => {
    await initHandler({
      dir: testDir,
      force: true,
      yes: true,
      use_variants: true
    });
  });

  it("Should build and upload all package variants", async () => {
    const buildResults = await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true,
      all_variants: true
    });

    const resultEntries = Object.entries(buildResults);

    const builtVariants = resultEntries.map(([, { variant }]) => variant);

    expect(builtVariants).to.have.lengthOf(defaultVariantsEnvValues.length);

    expect(builtVariants).to.have.members(defaultVariantsEnvValues);

    resultEntries.forEach(([dnpName, { releaseMultiHash, variant }]) => {
      // Check returned hash is correct
      expect(releaseMultiHash).to.include("/ipfs/Qm");
      expect(dnpName).to.include(variant);
    });
  });

  it("Should build and upload all package variants with custom variants dir", async () => {
    const customVariantsDirName = "custom_variants";

    // Ensure the directory exists before renaming
    const oldPath = path.join(testDir, defaultVariantsDirName);
    const newPath = path.join(testDir, customVariantsDirName);

    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    } else {
      throw new Error(`Directory ${oldPath} does not exist`);
    }

    const buildResults = await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true,
      variants: defaultVariantsEnvValues[0],
      variants_dir_name: customVariantsDirName
    });

    const resultEntries = Object.entries(buildResults);

    const builtVariants = resultEntries.map(([, { variant }]) => variant);

    expect(builtVariants).to.have.lengthOf(1);

    const [, { releaseMultiHash }] = resultEntries[0];

    expect(releaseMultiHash).to.include("/ipfs/Qm");
  });

  it("Should throw an error when all specified variants are invalid", async () => {
    await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true,
      variants: "invalid_variant",
      skip_save: true,
      skip_upload: true
    }).catch(error => {
      expect(error.message).to.include("No valid variants specified");
    });
  });

  it("Should only build valid variants", async () => {
    const buildResults = await buildHandler({
      dir: testDir,
      provider: contentProvider,
      upload_to: "ipfs",
      timeout: "5min",
      verbose: true,
      variants: `${defaultVariantsEnvValues[0]},invalid_variant`
    });

    const resultEntries = Object.entries(buildResults);

    const builtVariants = resultEntries.map(([, { variant }]) => variant);

    expect(builtVariants).to.have.lengthOf(1);

    expect(builtVariants[0]).to.equal(defaultVariantsEnvValues[0]);
  });
});
