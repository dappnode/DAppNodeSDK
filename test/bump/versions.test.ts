import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  extractImageSource,
  findImageSource,
  renderDockerTag
} from "../../src/bump/dockerfile.js";
import {
  highestSemverTag,
  isOlderVersion,
  versionCandidates
} from "../../src/bump/versions.js";
import { pickLatestRelease } from "../../src/commands/githubActions/bumpUpstream/github/pickLatestRelease.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

const release = (tag_name: string, draft = false, prerelease = false) => ({
  tag_name,
  draft,
  prerelease
});

describe("bump version selection and Dockerfile templates", () => {
  it("selects the first eligible release with optional tag extraction", () => {
    const releases = [
      release("v9.0.0", true),
      release("v8.0.0", false, true),
      release("v7.0.0-NiGhTlY"),
      release("n8n@6.0.0-rc.1"),
      release("op-deployer/v0.9.0-allowlist"),
      release("op-node/v1.2.3"),
      release("op-node/v1.1.0")
    ];
    expect(pickLatestRelease(releases, "^op-node/(v.*)$")).to.equal("v1.2.3");
    // Without a pattern another tag family wins: `-allowlist` is not a pre-release word.
    expect(pickLatestRelease(releases)).to.equal(
      "op-deployer/v0.9.0-allowlist"
    );
    const warn = console.warn;
    const warnings: string[] = [];
    try {
      console.warn = message => warnings.push(message);
      expect(pickLatestRelease([release("release_2026")])).to.equal(
        "release_2026"
      );
      expect(
        pickLatestRelease([release("bad tag"), release("stable")])
      ).to.equal("stable");
    } finally {
      console.warn = warn;
    }
    expect(warnings).to.have.length(2);
    expect(pickLatestRelease([release("v2.0.0-rc.1")])).to.equal(null);
    expect(pickLatestRelease([release("nightly/v1.0.0")], "(v.*)$")).to.equal(
      null
    );
  });

  it("tries the original tag before a bare semver suffix", () => {
    expect(versionCandidates("v1.2.3")).to.deep.equal(["v1.2.3", "1.2.3"]);
    expect(versionCandidates("n8n@2.10.3")).to.deep.equal([
      "n8n@2.10.3",
      "2.10.3"
    ]);
    expect(versionCandidates("1.2.3")).to.deep.equal(["1.2.3"]);
    expect(versionCandidates("stable")).to.deep.equal(["stable"]);
    expect(isOlderVersion("v1.2.3", "n8n@2.10.3")).to.equal(true);
    expect(isOlderVersion("stable", "v2.0.0")).to.equal(false);
  });

  it("prefers stable image tags, highest semver, and bare tags on ties", () => {
    expect(
      highestSemverTag(["latest", "3.0.0-rc.1", "v2.0.0", "1.9.0", "2.0.0"])
    ).to.equal("2.0.0");
    expect(highestSemverTag(["v1.0.0-rc.1", "1.0.0-rc.2"])).to.equal(
      "1.0.0-rc.2"
    );
    expect(highestSemverTag(["latest", "1.0", "n8n@1.2.3"])).to.equal(null);
    expect(highestSemverTag(["1.0.0+build", "v0.9.0"])).to.equal("1.0.0+build");
  });

  it("expands direct, indirect and static Dockerfile arguments", () => {
    const source = extractImageSource(
      "ARG BASE_IMAGE=statusim/nimbus-eth2\nARG ARCH=multiarch\nARG BASE_TAG=${ARCH}-${VERSION}\nFROM --platform=$TARGETPLATFORM ${BASE_IMAGE}:${BASE_TAG} AS base\n",
      "VERSION"
    );
    expect(source).to.deep.equal({
      image: "statusim/nimbus-eth2",
      template: "multiarch-{version}"
    });
    expect(renderDockerTag(source!, "v26.10.0")).to.equal("multiarch-v26.10.0");
    expect(
      extractImageSource("FROM host:5000/org/app:$VERSION", "VERSION")
    ).to.deep.equal({ image: "host:5000/org/app", template: "{version}" });
    expect(
      extractImageSource("FROM app:${VERSION#v}", "VERSION")
    ).to.deep.equal({ image: "app", template: "{version#v}" });
    expect(
      renderDockerTag({ image: "app", template: "{version#v}" }, "v1.2.3")
    ).to.equal("1.2.3");
    expect(
      extractImageSource(
        "FROM node:22\nRUN npm install app@${VERSION}",
        "VERSION"
      )
    ).to.equal(null);
    expect(extractImageSource("FROM app:$VERSION_EXTRA", "VERSION")).to.equal(
      null
    );
  });

  it("finds the service context and Dockerfile with mapping or list args", () => {
    const dir = temporaryDirectory();
    try {
      fs.mkdirSync(path.join(dir, "build"));
      fs.writeFileSync(
        path.join(dir, "build", "custom.dockerfile"),
        "FROM org/app:$VERSION\n"
      );
      for (const args of [{ VERSION: "1" }, ["VERSION=1"]])
        expect(
          findImageSource(
            dir,
            {
              services: {
                unrelated: { build: "." },
                app: {
                  build: {
                    context: "build",
                    dockerfile: "custom.dockerfile",
                    args
                  }
                }
              }
            },
            "VERSION"
          )
        ).to.deep.equal({ image: "org/app", template: "{version}" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
