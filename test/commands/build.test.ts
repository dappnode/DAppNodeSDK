import { expect } from "chai";
import { cleanTestDir, testDir } from "../testUtils.js";
import { initHandler } from "../../src/commands/init/handler.js";
import { buildHandler } from "../../src/commands/build.js";

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

    // Check returned hash is correct
    expect(buildResults[0].releaseMultiHash).to.include("/ipfs/Qm");
  });
});
