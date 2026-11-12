import { expect } from "chai";
import {
  compileTagPattern,
  extractVersion,
  parseProvider
} from "../../src/bump/metadata.js";

describe("bump / metadata", () => {
  describe("parseProvider", () => {
    it("defaults to docker", () => {
      expect(parseProvider(undefined)).to.equal("docker");
      expect(parseProvider(" ")).to.equal("docker");
    });

    it("accepts docker_tags aliases case-insensitively", () => {
      for (const name of [
        "docker_tags",
        "DOCKER_TAGS",
        "docker-tags",
        "dockerhub"
      ])
        expect(parseProvider(name)).to.equal("docker_tags");
    });

    it("rejects unknown providers", () => {
      expect(() => parseProvider("npm")).to.throw("Unknown upstream provider");
      expect(() => parseProvider("constructor")).to.throw(
        "Unknown upstream provider"
      );
    });
  });

  describe("compileTagPattern", () => {
    for (const pattern of [
      "[",
      "(?=a)",
      "(?<=a)b",
      "(a)\\1",
      "(?<foo>a)\\k<foo>"
    ]) {
      it(`rejects ${pattern}`, () => {
        expect(() => compileTagPattern(pattern)).to.throw();
      });
    }

    it("accepts an escaped backslash followed by a digit", () => {
      expect(compileTagPattern(String.raw`^a\\1$`)).to.be.instanceOf(RegExp);
    });
  });

  describe("extractVersion", () => {
    it("returns capture group 1", () => {
      expect(extractVersion("op-node/v1.2.3", "^op-node/(v.*)$")).to.equal(
        "v1.2.3"
      );
    });

    it("returns the whole match when the pattern has no group", () => {
      expect(extractVersion("v1.2.3", "v.*")).to.equal("v1.2.3");
    });

    it("returns null when the tag does not match", () => {
      expect(extractVersion("other/v1", "^node/(.*)$")).to.equal(null);
    });
  });
});
