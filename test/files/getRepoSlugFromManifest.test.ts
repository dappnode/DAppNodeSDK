import { expect } from "chai";
import { parseGithubRepoSlug } from "../../src/files/manifest/getRepoSlugFromManifest.js";

describe("GitHub repository slug from the manifest", () => {
  it("accepts the forms used by real package manifests", () => {
    for (const url of [
      "https://github.com/dappnode/DAppNodePackage-geth.git",
      "git+https://github.com/dappnode/DAppNodePackage-geth.git",
      "https://github.com/dappnode/DAppNodePackage-geth",
      "git+https://github.com/dappnode/DAppNodePackage-geth",
      "https://github.com/dappnode/DAppNodePackage-geth/"
    ])
      expect(parseGithubRepoSlug(url), url).to.equal(
        "dappnode/DAppNodePackage-geth"
      );
  });

  it("only strips a trailing .git", () => {
    expect(
      parseGithubRepoSlug("https://github.com/dappnode/tools.github-x")
    ).to.equal("dappnode/tools.github-x");
  });

  it("rejects URLs that merely mention github.com", () => {
    for (const url of [
      "https://evil.example/?https://github.com/dappnode/x",
      "https://github.com.evil.example/dappnode/x",
      "http://github.com/dappnode/x",
      "https://github.com/dappnode",
      "not a url"
    ])
      expect(parseGithubRepoSlug(url), url).to.equal("");
  });
});
