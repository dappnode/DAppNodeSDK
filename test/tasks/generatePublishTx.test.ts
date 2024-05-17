import { expect } from "chai";
import { defaultManifestFormat } from "../../src/params.js";
import { generatePublishTxs } from "../../src/tasks/generatePublishTxs/index.js";
import { writeManifest } from "../../src/files/index.js";
import { testDir, cleanTestDir } from "../testUtils.js";
import { VariantsMap } from "../../src/tasks/buildAndUpload/types.js";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe("generatePublishTx", function () {
  this.timeout(60 * 1000);

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should generate a publish TX", async function () {
    const manifest = {
      name: "admin.dnp.dappnode.eth",
      version: "0.1.0"
    };
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });

    const variantsMap: VariantsMap = {
      // TODP: Fix this test
    };

    const generatePublishTxTasks = generatePublishTxs({
      rootDir: testDir,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      ethProvider: "infura",
      verbosityOptions: { renderer: "verbose" },
      variantsMap
    });

    // TODO: Fix when publish is adapted to multi-variant packages
    const generateTxResults = await generatePublishTxTasks.run();
    const { txData } = generateTxResults[manifest.name];

    expect(txData).to.be.an("object");
    // admin.dnp.dappnode.eth ==> 0xEe66C4765696C922078e8670aA9E6d4F6fFcc455

    expect(txData).to.deep.equal({
      to: "0xEe66C4765696C922078e8670aA9E6d4F6fFcc455",
      value: 0,
      data:
        "0x73053410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 300000,
      ensName: "admin.dnp.dappnode.eth",
      currentVersion: "0.1.0",
      releaseMultiHash: "/ipfs/Qm"
    });
    // I am not sure if the Data property will be the same
    expect(txData?.data).to.be.a("string");
  });

  it("Should generate a publish TX", async function () {
    const manifest = {
      name: "new-repo.dnp.dappnode.eth",
      version: "0.1.0"
    };
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });

    const variantsMap: VariantsMap = {
      // TODP: Fix this test
    };

    const generatePublishTxTasks = generatePublishTxs({
      rootDir: testDir,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      ethProvider: "infura",
      verbosityOptions: { renderer: "verbose" },
      variantsMap
    });
    const publishResult = await generatePublishTxTasks.run();

    const { txData } = publishResult[manifest.name];

    expect(txData).to.be.an("object");

    expect(txData).to.deep.equal({
      to: "0x266BFdb2124A68beB6769dC887BD655f78778923",
      value: 0,
      data:
        "0x32ab6af000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000086e65772d7265706f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 1100000,
      ensName: "new-repo.dnp.dappnode.eth",
      currentVersion: "0.1.0",
      releaseMultiHash: "/ipfs/Qm",
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
    });
    // I am not sure if the Data property will be the same
    expect(txData?.data).to.be.a("string");
  });
});
