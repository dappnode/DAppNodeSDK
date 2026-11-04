import { mock } from "node:test";
import registryAbi from "../../../src/contracts/ApmRegistryAbi.json" with { type: "json" };
import {
  Contract,
  Interface,
  JsonRpcProvider,
  toUtf8Bytes,
  hexlify,
  type TransactionRequest
} from "ethers";
import { expect } from "chai";
import { ApmRepository } from "../../../src/providers/apm/ApmRepository.js";
import { buildTxData } from "../../../src/tasks/generatePublishTxs/index.js";
import abi from "../../../src/contracts/RepoAbi.json" with { type: "json" };

const address = "0x0000000000000000000000000000000000001234";
class LocalProvider extends JsonRpcProvider {
  constructor(private readonly registered = true) {
    super("http://unused", 1, { staticNetwork: true });
  }
  async resolveName(): Promise<string | null> {
    return this.registered ? address : null;
  }
  async call(tx: TransactionRequest): Promise<string> {
    const contract = new Interface(abi);
    expect(tx.to).to.equal(address);
    expect(tx.data).to.equal(contract.encodeFunctionData("getLatest"));
    return contract.encodeFunctionResult("getLatest", [
      [1, 2, 3],
      address,
      hexlify(toUtf8Bytes("/ipfs/QmLatest"))
    ]);
  }
}

describe("minimal APM client", () => {
  it("resolves ENS and decodes the existing contract ABI", async () => {
    const provider = new LocalProvider();
    try {
      const client = new ApmRepository("http://unused", provider);
      expect(
        await client.getVersionAndIpfsHash({
          dnpNameOrHash: "demo.public.dappnode.eth"
        })
      ).to.deep.equal({ version: "1.2.3", contentUri: "/ipfs/QmLatest" });
      expect(
        await client.getRepoContract("demo.public.dappnode.eth")
      ).to.be.instanceOf(Contract);
    } finally {
      provider.destroy();
    }
  });

  it("preserves new-repository detection", async () => {
    const provider = new LocalProvider(false);
    try {
      const error = await new ApmRepository("http://unused", provider)
        .getRepoContract("new.public.dappnode.eth")
        .catch(error => error);
      expect(error.message).to.include("NOREPO");
    } finally {
      provider.destroy();
    }
  });

  it("generates an existing-repository transaction without a live RPC", async () => {
    const provider = new LocalProvider();
    try {
      const result = await buildTxData({
        apm: new ApmRepository("http://unused", provider),
        contractAddress: address,
        dnpName: "demo.public.dappnode.eth",
        version: "1.2.4",
        releaseMultiHash: "/ipfs/QmNext",
        developerAddress: address,
        ethereumUrl: "http://unused"
      });
      const decoded = new Interface(abi).decodeFunctionData(
        "newVersion",
        result.data
      );
      expect(result.to).to.equal(address);
      expect([...decoded[0]]).to.deep.equal([1n, 2n, 4n]);
      expect(decoded[2]).to.equal(hexlify(toUtf8Bytes("/ipfs/QmNext")));
    } finally {
      provider.destroy();
    }
  });
  it("generates a new-repository transaction after an unresolved package name", async () => {
    const provider = new LocalProvider(false);
    const registry = "0x0000000000000000000000000000000000005678";
    const resolution = mock.method(
      JsonRpcProvider.prototype,
      "resolveName",
      async () => registry
    );
    try {
      const result = await buildTxData({
        apm: new ApmRepository("http://unused", provider),
        contractAddress: address,
        dnpName: "new.public.dappnode.eth",
        version: "0.1.0",
        releaseMultiHash: "/ipfs/QmNew",
        developerAddress: address,
        ethereumUrl: "http://unused"
      });
      const decoded = new Interface(registryAbi).decodeFunctionData(
        "newRepoWithVersion",
        result.data
      );
      expect(result.to).to.equal(registry);
      expect(decoded[0]).to.equal("new");
      expect(decoded[1]).to.equal(address);
      expect([...decoded[2]]).to.deep.equal([0n, 1n, 0n]);
    } finally {
      resolution.mock.restore();
      provider.destroy();
    }
  });

  it("propagates RPC failures instead of treating them as an unpublished package", async () => {
    const provider = new LocalProvider();
    const rpcFailure = new Error("RPC timeout");
    const resolution = mock.method(provider, "resolveName", async () => {
      throw rpcFailure;
    });
    try {
      const error = await buildTxData({
        apm: new ApmRepository("http://unused", provider),
        contractAddress: address,
        dnpName: "demo.public.dappnode.eth",
        version: "0.1.0",
        releaseMultiHash: "/ipfs/QmNew",
        developerAddress: address,
        ethereumUrl: "http://unused"
      }).catch(error => error);
      expect(error).to.equal(rpcFailure);
    } finally {
      resolution.mock.restore();
      provider.destroy();
    }
  });
});
