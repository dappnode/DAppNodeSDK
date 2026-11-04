import { expect } from "chai";
import { Github } from "../../../src/providers/github/Github.js";

describe("GitHub branch pagination", () => {
  it("uses the paginator so cleanup sees branches after the first page", async () => {
    const original = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";
    try {
      const github = new Github({ owner: "example", repo: "demo" });
      const branches = Array.from({ length: 135 }, (_, index) => ({
        name: `branch-${index}`
      }));
      const listBranches = () => {};
      let called = false;
      (github as unknown as { octokit: unknown }).octokit = {
        rest: { repos: { listBranches } },
        paginate: async (method: unknown, parameters: { per_page: number }) => {
          expect(method).to.equal(listBranches);
          expect(parameters.per_page).to.equal(100);
          called = true;
          return branches;
        }
      };
      expect(await github.listBranches()).to.have.length(135);
      expect(called).to.equal(true);
    } finally {
      if (original === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = original;
    }
  });
});
