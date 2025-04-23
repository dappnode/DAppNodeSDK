// test/utils/ipfs.test.ts
import { expect } from "chai";
import { isIpfsHash, parseIpfsPath } from "../../src/utils/isIpfsHash.js";

describe("util > ipfs", () => {
  /* ------------------------------------------------------------------ */
  /* parseIpfsPath                                                      */
  /* ------------------------------------------------------------------ */
  it("strips the `ipfs/` segment from a bare path", () => {
    const cid = "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o";
    expect(parseIpfsPath(`ipfs/${cid}`)).to.equal(cid);
  });

  it("strips the `ipfs/` segment from a gateway URL", () => {
    const cid = "QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o";
    const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
    expect(parseIpfsPath(url)).to.equal(cid);
  });

  it("returns the input unchanged when no `ipfs/` segment exists", () => {
    const cid = "zdj7WWeQ43G6JJvLWQWZpyHuAMq6uYWRjkBXFad11vE2LHhQ7";
    expect(parseIpfsPath(cid)).to.equal(cid);
  });

  /* ------------------------------------------------------------------ */
  /* isIpfsHash                                                         */
  /* ------------------------------------------------------------------ */
  it("accepts a valid CIDv0", () => {
    expect(
      isIpfsHash("QmYjtig7VJQ6XsnUjqqJvj7QaMcCAwtrgNdahSiFofrE7o")
    ).to.be.true;
  });

  it("accepts a valid CIDv1", () => {
    expect(
      isIpfsHash("zdj7WWeQ43G6JJvLWQWZpyHuAMq6uYWRjkBXFad11vE2LHhQ7")
    ).to.be.true;
  });

  it("accepts a valid CID presented as `ipfs/<cid>`", () => {
    expect(
      isIpfsHash(
        "ipfs/zdj7WWeQ43G6JJvLWQWZpyHuAMq6uYWRjkBXFad11vE2LHhQ7"
      )
    ).to.be.true;
  });

  it("rejects obvious garbage", () => {
    expect(isIpfsHash("noop")).to.be.false;
    expect(isIpfsHash("")).to.be.false;
  });

  it("rejects non‑string values", () => {
    expect(isIpfsHash(undefined as unknown as string)).to.be.false;
    expect(isIpfsHash(null as unknown as string)).to.be.false;
    expect(isIpfsHash(123 as unknown as string)).to.be.false;
  });
});

