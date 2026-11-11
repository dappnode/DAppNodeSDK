import { expect } from "chai";
import { pickLatestRelease } from "../../../src/commands/githubActions/bumpUpstream/github/index.js";

const release = (
  tag_name: string,
  { draft = false, prerelease = false } = {}
) => ({ tag_name, draft, prerelease });

describe("command / gaBumpUpstream / pickLatestRelease", () => {
  it("returns the newest release when it is stable", () => {
    expect(pickLatestRelease([release("v1.2.0"), release("v1.1.0")])).to.equal(
      "v1.2.0"
    );
  });

  it("skips a newer release flagged as pre-release", () => {
    expect(
      pickLatestRelease([
        release("0.3.5-rc.1", { prerelease: true }),
        release("0.3.4")
      ])
    ).to.equal("0.3.4");
  });

  it("skips a newer release candidate tag that is not flagged", () => {
    expect(
      pickLatestRelease([release("v1.2.0-rc.1"), release("v1.1.0")])
    ).to.equal("v1.1.0");
  });

  it("skips drafts and nightly builds", () => {
    expect(
      pickLatestRelease([
        release("v2.0.0", { draft: true }),
        release("nightly-2026-11-10"),
        release("v1.9.0")
      ])
    ).to.equal("v1.9.0");
  });

  it("returns null when no release is stable", () => {
    expect(
      pickLatestRelease([
        release("v2.0.0-rc.2", { prerelease: true }),
        release("v2.0.0-rc.1")
      ])
    ).to.equal(null);
  });
});
