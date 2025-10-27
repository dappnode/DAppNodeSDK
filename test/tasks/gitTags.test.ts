// Import the necessary modules
import { expect } from "chai";
import { describe, it } from "mocha";
import { getNextGitTag } from "../../src/tasks/createGithubRelease/getNextGitTag.js";

// Describe your test suite
describe("getNextGitTag", () => {
  it("should format a single-variant package correctly (not multi-variant)", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: "mainnet",
        nextVersion: "0.1.2"
      }
    };
    const result = getNextGitTag(ctx, false);
    expect(result).to.equal("v0.1.2");
  });

  it("should not throw an error if single variant is missing (not multi-variant)", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: null,
        nextVersion: "0.1.2"
      }
    };
    expect(() => getNextGitTag(ctx, false)).to.not.throw()
  });

  it("should throw an error if single variant is missing (multi-variant)", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: null,
        nextVersion: "0.1.2"
      }
    };
    expect(() => getNextGitTag(ctx, true)).to.throw("Could not generate git tag. Missing variant");
  });

  it("should format a single-variant package as variant@v<version> if isMultiVariant is true", () => {
    const ctx = {
      "gnosis.dnp.dapnode.eth": {
        variant: "gnosis",
        nextVersion: "0.1.2"
      }
    };
    const result = getNextGitTag(ctx, true);
    expect(result).to.equal("gnosis@v0.1.2");
  });

  it("should format and sort a multi-variant package correctly (isMultiVariant)", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: "mainnet",
        nextVersion: "0.1.3"
      },
      "goerli-geth.dnp.dapnode.eth": {
        variant: "goerli",
        nextVersion: "0.1.2"
      },
      "holesky-geth.dnp.dapnode.eth": {
        variant: "holesky",
        nextVersion: "0.1.1"
      }
    };
    const result = getNextGitTag(ctx, true);
    expect(result).to.equal("goerli@v0.1.2_holesky@v0.1.1_mainnet@v0.1.3");
  });

  it("should throw if any variant is missing", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: null,
        nextVersion: "0.1.2"
      }
    };
    expect(() => getNextGitTag(ctx, true)).to.throw();
  });

  it("should throw if no variants are present", () => {
    const ctx = {};
    expect(() => getNextGitTag(ctx, true)).to.throw();
  });
});
