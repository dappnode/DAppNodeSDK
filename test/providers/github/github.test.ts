import { expect } from "chai";
import { Github } from "../../../src/providers/github/Github.js";

describe("Test Github read-only methods", function () {
  this.timeout(10000); // Increase timeout for GitHub API calls

  const owner = "dappnode";
  const repo = "DAppNodeSDK";
  const github = new Github({ owner, repo });

  describe("getRepo", () => {
    it("should return repository data", async () => {
      const result = await github.getRepo();
      expect(result).to.have.property("name", repo);
      expect(result).to.have.property("owner");
      expect(result.owner).to.have.property("login", owner);
    });

    it("should throw an error if repo does not exist", async () => {
      const invalidGithub = new Github({
        owner: "invalid-owner",
        repo: "invalid-repo"
      });
      try {
        await invalidGithub.getRepo();
        throw new Error("Expected method to reject.");
      } catch (e) {
        expect(e.message).to.include("Repo does not exist");
      }
    });
  });

  describe("listReleases", () => {
    it("should return list of releases", async () => {
      const result = await github.listReleases();
      expect(result).to.be.an("array");
      if (result.length > 0) {
        expect(result[0]).to.have.property("tag_name");
      }
    });
  });

  describe("getBranch", () => {
    it("should return branch data", async () => {
      const result = await github.getBranch("master");
      expect(result).to.have.property("name", "master");
      expect(result).to.have.property("commit");
      expect(result.commit).to.have.property("sha");
    });
  });

  describe("listBranches", () => {
    it("should return list of branches", async () => {
      const result = await github.listBranches();
      expect(result).to.be.an("array");
      if (result.length > 0) {
        expect(result[0]).to.have.property("name");
      }
    });
  });

  describe("getOpenPrsFromBranch", () => {
    it("should return list of open PRs from a branch", async () => {
      const result = await github.getOpenPrsFromBranch("master");
      expect(result).to.be.an("array");
      if (result.length > 0) {
        expect(result[0]).to.have.property("head");
        expect(result[0].head).to.have.property("ref");
      }
    });
  });
});
