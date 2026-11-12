import { expect } from "chai";
import { branchNeedsPr } from "../../../src/commands/githubActions/bumpUpstream/github/index.js";

const branchName = "dappnodebot/bump-upstream/org/repo@1.2.0";

function fakeRepo({
  remoteBranch,
  prStates
}: {
  remoteBranch: boolean;
  prStates: string[];
}) {
  return {
    branchExists: async () => remoteBranch,
    getPrsFromBranch: async () => prStates.map(state => ({ state }))
  };
}

describe("command / gaBumpUpstream / branchNeedsPr", () => {
  it("is true for a pushed bump branch that never got a PR", async () => {
    const repo = fakeRepo({ remoteBranch: true, prStates: [] });
    expect(await branchNeedsPr({ repo, branchName })).to.equal(true);
  });

  it("is false when the branch has an open PR", async () => {
    const repo = fakeRepo({ remoteBranch: true, prStates: ["open"] });
    expect(await branchNeedsPr({ repo, branchName })).to.equal(false);
  });

  it("is false when the branch's PR was closed", async () => {
    const repo = fakeRepo({ remoteBranch: true, prStates: ["closed"] });
    expect(await branchNeedsPr({ repo, branchName })).to.equal(false);
  });

  it("is false when the branch exists only locally", async () => {
    const repo = fakeRepo({ remoteBranch: false, prStates: [] });
    expect(await branchNeedsPr({ repo, branchName })).to.equal(false);
  });
});
