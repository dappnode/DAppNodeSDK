const expect = require("chai").expect;
const fs = require("fs");
const generatePublishTx = require("../../src/tasks/generatePublishTx");
const rmSafe = require("../rmSafe");
const mkdirSafe = require("../mkdirSafe");

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe("generatePublishTx", () => {
  const manifestPath = "./dappnode_package.json";
  const buildDir = "dnp_0.0.0";
  const deployTextPath = `${buildDir}/deploy.txt`;

  before(async () => {
    await rmSafe(manifestPath);
    await rmSafe(buildDir);
    await mkdirSafe(buildDir);
  });

  it("Should generate a publish TX", async () => {
    const manifest = {
      name: "admin.dnp.dappnode.eth",
      version: "0.1.0"
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const generatePublishTxTasks = generatePublishTx({
      manifestIpfsPath: "/ipfs/Qm",
      buildDir,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      ethProvider: "infura",
      verbose: true
    });
    const { txData } = await generatePublishTxTasks.run();
    expect(txData).to.be.an("object");
    // admin.dnp.dappnode.eth ==> 0xEe66C4765696C922078e8670aA9E6d4F6fFcc455

    expect(txData).to.deep.equal({
      to: "0xee66c4765696c922078e8670aa9e6d4f6ffcc455",
      value: 0,
      data:
        "0x73053410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 300000,
      ensName: "admin.dnp.dappnode.eth",
      currentVersion: "0.1.0",
      manifestIpfsPath: "/ipfs/Qm"
    });
    // I am not sure if the Data property will be the same
    expect(txData.data).to.be.a("string");
  }).timeout(60 * 1000);

  it("Should generate a publish TX", async () => {
    const manifest = {
      name: "new-repo.dnp.dappnode.eth",
      version: "0.1.0"
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    const generatePublishTxTasks = generatePublishTx({
      manifestIpfsPath: "/ipfs/Qm",
      buildDir,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      ethProvider: "infura",
      verbose: true
    });
    const { txData } = await generatePublishTxTasks.run();
    expect(txData).to.be.an("object");

    expect(txData).to.deep.equal({
      to: "0x266bfdb2124a68beb6769dc887bd655f78778923",
      value: 0,
      data:
        "0x32ab6af000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000086e65772d7265706f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 1100000,
      ensName: "new-repo.dnp.dappnode.eth",
      currentVersion: "0.1.0",
      manifestIpfsPath: "/ipfs/Qm",
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
    });
    // I am not sure if the Data property will be the same
    expect(txData.data).to.be.a("string");
  }).timeout(60 * 1000);

  after(async () => {
    await rmSafe(manifestPath);
    await rmSafe(deployTextPath);
    await rmSafe(buildDir);
  });
});
