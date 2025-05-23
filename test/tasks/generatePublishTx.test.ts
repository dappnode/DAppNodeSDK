import { expect } from "chai";
import { defaultManifestFormat } from "../../src/params.js";
import { buildTxData } from "../../src/tasks/generatePublishTxs/index.js";
import { writeManifest } from "../../src/files/index.js";
import { testDir, cleanTestDir } from "../testUtils.js";
import { getEthereumUrl } from "../../src/utils/getEthereumUrl.js";
import { ApmRepository } from "@dappnode/toolkit";

// This test will create the following fake files
// ./dappnode_package.json  => fake manifest
// ./dnp_0.0.0/             => build directory
//
// Then it will expect the function to generate transaction data
// and output it to the console and to ./dnp_0.0.0/deploy.txt

describe("generatePublishTx", async function () {
  this.timeout(60 * 1000);

  const burnAddress = "0x0000000000000000000000000000000000000000";
  const ethProvider = "remote";
  const ethereumUrl = getEthereumUrl(ethProvider);
  const apm = new ApmRepository(ethereumUrl);

  before("Clean testDir", () => cleanTestDir());
  after("Clean testDir", () => cleanTestDir());

  it("Should generate a publish TX", async function () {
    const manifest = {
      name: "admin.dnp.dappnode.eth",
      version: "0.1.0"
    };
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });

    const { name, version } = manifest;

    const txData = await buildTxData({
      apm,
      contractAddress: burnAddress,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      dnpName: name,
      releaseMultiHash: "/ipfs/Qm",
      version: version,
      ethereumUrl
    });

    expect(txData).to.be.an("object");

    expect(txData).to.deep.equal({
      to: "0xEe66C4765696C922078e8670aA9E6d4F6fFcc455", // admin.dnp.dappnode.eth resolves to this address
      value: 0,
      data:
        "0x73053410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 300000,
      ensName: name,
      currentVersion: version,
      releaseMultiHash: "/ipfs/Qm"
    });
  });

  it("Should generate a publish TX", async function () {
    const manifest = {
      name: "new-repo.dnp.dappnode.eth",
      version: "0.1.0"
    };
    writeManifest(manifest, defaultManifestFormat, { dir: testDir });

    const { name, version } = manifest;

    const txData = await buildTxData({
      apm,
      contractAddress: burnAddress,
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
      dnpName: name,
      releaseMultiHash: "/ipfs/Qm",
      version: version,
      ethereumUrl
    });

    expect(txData).to.be.an("object");

    expect(txData).to.deep.equal({
      to: "0x266BFdb2124A68beB6769dC887BD655f78778923", // Registry contract address
      value: 0,
      data:
        "0x32ab6af000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000086e65772d7265706f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082f697066732f516d000000000000000000000000000000000000000000000000",
      gasLimit: 1100000,
      ensName: name,
      currentVersion: version,
      releaseMultiHash: "/ipfs/Qm",
      developerAddress: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
    });
  });
});
