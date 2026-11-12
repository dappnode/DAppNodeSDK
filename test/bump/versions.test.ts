import { expect } from "chai";
import {
  highestSemverTag,
  isOlderVersion,
  versionCandidates
} from "../../src/bump/versions.js";

describe("bump / versions", () => {
  describe("versionCandidates", () => {
    it("tries the tag before its bare semver", () => {
      expect(versionCandidates("v1.2.3")).to.deep.equal(["v1.2.3", "1.2.3"]);
      expect(versionCandidates("n8n@2.10.3")).to.deep.equal([
        "n8n@2.10.3",
        "2.10.3"
      ]);
    });

    it("returns bare and non-semver tags as they are", () => {
      expect(versionCandidates("1.2.3")).to.deep.equal(["1.2.3"]);
      expect(versionCandidates("stable")).to.deep.equal(["stable"]);
    });
  });

  describe("isOlderVersion", () => {
    it("compares versions after removing their prefix", () => {
      expect(isOlderVersion("v1.2.3", "n8n@2.10.3")).to.equal(true);
    });

    it("never reports a non-semver version as older", () => {
      expect(isOlderVersion("stable", "v2.0.0")).to.equal(false);
    });
  });

  describe("highestSemverTag", () => {
    it("prefers stable tags, then the highest version, then the tag without v", () => {
      expect(
        highestSemverTag(["latest", "3.0.0-rc.1", "v2.0.0", "1.9.0", "2.0.0"])
      ).to.equal("2.0.0");
    });

    it("uses pre-releases only when there is no stable tag", () => {
      expect(highestSemverTag(["v1.0.0-rc.1", "1.0.0-rc.2"])).to.equal(
        "1.0.0-rc.2"
      );
    });

    it("ignores tags that are not MAJOR.MINOR.PATCH", () => {
      expect(highestSemverTag(["latest", "1.0", "n8n@1.2.3"])).to.equal(null);
      expect(highestSemverTag(["1.0.0+build", "v0.9.0"])).to.equal(
        "1.0.0+build"
      );
    });
  });
});
