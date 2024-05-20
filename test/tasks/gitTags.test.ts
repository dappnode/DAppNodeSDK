// Import the necessary modules
import { expect } from "chai";
import { describe, it } from "mocha";
import { getNextGitTag } from "../../src/tasks/createGithubRelease/getNextGitTag.js";

// Describe your test suite
describe("getNextGitTag", () => {
  it("should format a single-variant package correctly", () => {
    const ctx = {
      "geth.dnp.dapnode.eth": {
        variant: "mainnet",
        nextVersion: "0.1.2"
      }
    };
    const result = getNextGitTag(ctx);
    expect(result).to.equal("v0.1.2");
  });

  it("should format and sort a multi-variant package correctly", () => {
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
    const result = getNextGitTag(ctx);
    expect(result).to.equal("goerli@0.1.2_holesky@0.1.1_mainnet@0.1.3");
  });
});
