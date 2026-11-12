import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  discoverUpstreams,
  packageManifestDirs,
  BumpCompose
} from "../../src/bump/discovery.js";
import {
  compileTagPattern,
  parseProvider,
  extractVersion
} from "../../src/bump/metadata.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

const compose: BumpCompose = {
  services: { app: { build: { args: { APP_TAG: "1.0.0" } } } }
};

describe("bump discovery and metadata", () => {
  it("discovers array and legacy fields, inferring a single arg", () => {
    expect(
      discoverUpstreams(
        { upstream: [{ repo: "acme/app", version: "1.0.0" }] },
        compose
      )
    ).to.deep.equal([
      { repo: "acme/app", version: "1.0.0", arg: "APP_TAG", provider: "docker" }
    ]);
    expect(
      discoverUpstreams(
        {
          upstreamRepo: "acme/app",
          upstreamVersion: "1.0.0",
          upstreamProvider: "GITHUB"
        },
        compose
      )[0]
    ).to.include({ arg: "APP_TAG", provider: "github" });
    expect(
      discoverUpstreams(
        { upstreamRepo: "acme/app", upstreamVersion: "1.0.0" },
        { services: {} }
      )[0].arg
    ).to.equal("UPSTREAM_VERSION");
    expect(discoverUpstreams({}, compose)).to.deep.equal([]);
  });

  it("requires explicit multi-upstream args, and unique repos and args", () => {
    const upstream = [
      { repo: "acme/a", version: "1", arg: "A" },
      { repo: "acme/b", version: "2", arg: "B" }
    ];
    expect(discoverUpstreams({ upstream }, compose)).to.have.length(2);
    expect(() =>
      discoverUpstreams(
        { upstream: [upstream[0], { ...upstream[1], arg: undefined }] },
        compose
      )
    ).to.throw("multi-upstream");
    expect(() =>
      discoverUpstreams(
        { upstream: [upstream[0], { ...upstream[1], repo: "acme/a" }] },
        compose
      )
    ).to.throw("repositories must be unique");
    expect(() =>
      discoverUpstreams(
        { upstream: [upstream[0], { ...upstream[1], arg: "A" }] },
        compose
      )
    ).to.throw("args must be unique");
    expect(() =>
      discoverUpstreams(
        { upstreamRepo: "acme/app", upstreamVersion: "1" },
        { services: { app: { build: { args: ["A_VERSION=1", "B_TAG=2"] } } } }
      )
    ).to.throw("uniquely detect");
  });

  it("normalizes providers and rejects invalid regex constructs", () => {
    for (const name of [
      "docker_tags",
      "DOCKER_TAGS",
      "docker-tags",
      "dockerhub"
    ])
      expect(parseProvider(name)).to.equal("docker_tags");
    expect(parseProvider(undefined)).to.equal("docker");
    expect(() => parseProvider("npm")).to.throw("Unknown upstream provider");
    for (const pattern of [
      "[",
      "(?=a)",
      "(?<=a)b",
      "(a)\\1",
      "(?<foo>a)\\k<foo>"
    ])
      expect(() => compileTagPattern(pattern), pattern).to.throw();
    expect(extractVersion("op-node/v1.2.3", "^op-node/(v.*)$")).to.equal(
      "v1.2.3"
    );
    expect(extractVersion("v1.2.3", "v.*")).to.equal("v1.2.3");
    expect(extractVersion("other/v1", "^node/(.*)$")).to.equal(null);
    expect(compileTagPattern(String.raw`^a\\1$`)).to.be.instanceOf(RegExp);
  });

  it("detects variant manifests automatically and supports legacy directories", () => {
    const dir = temporaryDirectory();
    try {
      expect(packageManifestDirs(dir)).to.deep.equal([dir]);
      for (const variant of ["mainnet", "testnet"]) {
        const base = path.join(dir, "package_variants", variant);
        fs.mkdirSync(base, { recursive: true });
        fs.writeFileSync(path.join(base, "dappnode_package.json"), "{}");
      }
      expect(
        packageManifestDirs(dir).map(file => path.basename(file))
      ).to.deep.equal(["mainnet", "testnet"]);
      fs.renameSync(
        path.join(dir, "package_variants"),
        path.join(dir, "legacy")
      );
      expect(packageManifestDirs(dir, "legacy")).to.have.length(2);
      fs.unlinkSync(
        path.join(dir, "legacy", "mainnet", "dappnode_package.json")
      );
      expect(() => packageManifestDirs(dir, "legacy")).to.throw(
        "Variant has no manifest"
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
