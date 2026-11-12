import { expect } from "chai";
import {
  pickLatestRelease,
  selectLatestRelease
} from "../../../src/commands/githubActions/bumpUpstream/github/index.js";

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

  it("treats suffixes that are not pre-release words as stable", () => {
    expect(
      pickLatestRelease([release("v1.17.11-beta.1"), release("v1.17.10-gc")])
    ).to.equal("v1.17.10-gc");
    expect(pickLatestRelease([release("n8n@2.46.6")])).to.equal("n8n@2.46.6");
  });

  it("filters tag families with tagPattern", () => {
    const releases = [
      release("op-deployer/v0.9.0-allowlist"),
      release("op-node/v1.20.1")
    ];
    expect(pickLatestRelease(releases, "^op-node/v(.+)$")).to.equal("1.20.1");
    // `-allowlist` is not a pre-release word, so without a pattern the other
    // tag family wins
    expect(pickLatestRelease(releases)).to.equal(
      "op-deployer/v0.9.0-allowlist"
    );
  });

  it("skips nightly tags even when tagPattern matches", () => {
    expect(pickLatestRelease([release("nightly/v1.0.0")], "(v.*)$")).to.equal(
      null
    );
  });

  it("accepts non-semver tags and skips tags with invalid characters", () => {
    const warn = console.warn;
    console.warn = () => undefined;
    try {
      expect(pickLatestRelease([release("release_2026")])).to.equal(
        "release_2026"
      );
      expect(
        pickLatestRelease([release("bad tag"), release("stable")])
      ).to.equal("stable");
    } finally {
      console.warn = warn;
    }
  });

  describe("selectLatestRelease", () => {
    const noList = async () => {
      throw Error("must not list releases");
    };

    it("prefers GitHub's Latest release when it qualifies", async () => {
      expect(await selectLatestRelease(release("v1.9.5"), noList)).to.equal(
        "v1.9.5"
      );
    });

    it("falls back to recent releases when Latest does not qualify", async () => {
      const recent = async () => [
        release("v5.1.0-rc.1"),
        release("v5.0.1", { draft: true }),
        release("v5.0.0")
      ];
      expect(
        await selectLatestRelease(release("v5.1.0-rc.1"), recent)
      ).to.equal("v5.0.0");
      expect(await selectLatestRelease(null, recent)).to.equal("v5.0.0");
    });

    it("applies tagPattern to Latest", async () => {
      const recent = async () => [release("op-node/v1.20.1")];
      expect(
        await selectLatestRelease(
          release("op-deployer/v0.9.0"),
          recent,
          "^op-node/v(.+)$"
        )
      ).to.equal("1.20.1");
    });
  });
});
