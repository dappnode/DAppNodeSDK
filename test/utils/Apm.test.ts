import semver from "semver";
import { expect } from "chai";
import { getEthereumUrl } from "../../src/utils/getEthereumUrl";
import { ethers } from "ethers";
import { ApmRepository } from "@dappnode/toolkit";
describe("Apm constructor", function () {
  this.timeout(60_000);

  const dnpName = "admin.dnp.dappnode.eth";

  it("Should get the contract the registry contract of a DNP name", async () => {
    const parsedProvider = new ethers.JsonRpcProvider(getEthereumUrl("infura"))
    const registry = await parsedProvider.resolveName(dnpName.split(".").slice(1).join("."))

    if (!registry) throw Error("no registry");
    expect(registry).to.be.a("string", "Contract instance changed");
    expect((registry).toLowerCase()).to.equal(
      "0x266BFdb2124A68beB6769dC887BD655f78778923".toLowerCase()
    );
  });

  it("Should get the contract the repo contract of a DNP name", async () => {
    const parsedProvider = new ethers.JsonRpcProvider(getEthereumUrl("infura"))
    const repo = await parsedProvider.resolveName(dnpName)

    if (!repo) throw Error("no repo");
    expect(repo).to.be.a("string", "Contract instance changed");
    expect(repo.toLowerCase()).to.equal(
      "0xEe66C4765696C922078e8670aA9E6d4F6fFcc455".toLowerCase()
    );
  });

  it("Should get the latest of a DNP name", async () => {
    const apm = new ApmRepository(getEthereumUrl("infura"))
    const latestVersion = await apm.getVersionAndIpfsHash({ dnpName })

    expect(latestVersion.version).to.be.a("string", "Contract instance changed");
    expect(Boolean(semver.valid(latestVersion.version))).to.equal(
      true,
      `Resulting version is not a valid semver: ${semver}`
    );
  });
});
