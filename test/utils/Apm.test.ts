import semver from "semver";
import { expect } from "chai";
import { Apm } from "../../src/utils/Apm";

describe.only("Apm constructor", function () {
  this.timeout(60_000);

  const dnpName = "admin.dnp.dappnode.eth";

  it("Should get the contract the registry contract of a DNP name", async () => {
    const apm = new Apm("infura");
    const registry = await apm.getRegistryContract(dnpName);

    if (!registry) throw Error("no registry");
    expect(registry.address).to.be.a("string", "Contract instance changed");
    expect(registry.address.toLowerCase()).to.equal(
      "0x266BFdb2124A68beB6769dC887BD655f78778923".toLowerCase()
    );
  });

  it("Should get the contract the repo contract of a DNP name", async () => {
    const apm = new Apm("infura");
    const repo = await apm.getRepoContract(dnpName);

    if (!repo) throw Error("no repo");
    expect(repo.address).to.be.a("string", "Contract instance changed");
    expect(repo.address.toLowerCase()).to.equal(
      "0xEe66C4765696C922078e8670aA9E6d4F6fFcc455".toLowerCase()
    );
  });

  it("Should get the latest of a DNP name", async () => {
    const apm = new Apm("infura");
    const latestVersion = await apm.getLatestVersion(dnpName);

    expect(latestVersion).to.be.a("string", "Contract instance changed");
    expect(Boolean(semver.valid(latestVersion))).to.equal(
      true,
      `Resulting version is not a valid semver: ${semver}`
    );
  });

  it("Should get all the IPFS hashes from a given dnpName", async () => {
    const expectedIpfsHashes = [
      "QmdSKdCBQ5Jy1GGDJkBMFi3LtkbCckoRwXoM67pNezdG1x",
      "QmTZDB4Mq1SpSk2iB211f8EHxgiP6tcTrtZAZayEzZMuev",
      "Qmabpx7SrMP9hie8Qh7fhpuEnji13V3fNmNBe1XrSVTfDp",
      "QmbDew4vuHa8cmJ2KH2bt9Pyd3uRq7j6Uezwb9rz5oozfU",
      "QmZAy91PeBJvg7ruv7tuEavvbGAEWDHxS7m4HeMxb7wBjQ",
      "QmVycHEPxcdVzw9sYmjJfq6Tj2hJpQwqYQWGg81baUJuD2",
      "QmbAtNRRRSojMRTWNoqH9qMWVWLRatpUbEyG9cNfS5W1Hw"
    ];
    const apm = new Apm("infura");
    const ipfsHashes = await apm.getIpfsHashesFromDnpName(
      "web3signer-gnosis.dnp.dappnode.eth"
    );

    expect(ipfsHashes).to.deep.equal(expectedIpfsHashes);
  });
});
