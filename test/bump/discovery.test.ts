import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  BumpCompose,
  discoverUpstreams,
  getPackageManifestDirs
} from "../../src/bump/discovery.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

const compose: BumpCompose = {
  services: { app: { build: { args: { APP_TAG: "1.0.0" } } } }
};

describe("bump / discovery", () => {
  describe("discoverUpstreams", () => {
    it("reads upstream[] and infers the arg of a single upstream", () => {
      const upstreams = discoverUpstreams(
        { upstream: [{ repo: "acme/app", version: "1.0.0" }] },
        compose
      );

      expect(upstreams).to.deep.equal([
        {
          repo: "acme/app",
          version: "1.0.0",
          arg: "APP_TAG",
          provider: "docker"
        }
      ]);
    });

    it("reads the legacy fields, including upstreamProvider", () => {
      const [upstream] = discoverUpstreams(
        {
          upstreamRepo: "acme/app",
          upstreamVersion: "1.0.0",
          upstreamProvider: "GITHUB"
        },
        compose
      );

      expect(upstream).to.include({ arg: "APP_TAG", provider: "github" });
    });

    it("defaults the arg to UPSTREAM_VERSION", () => {
      const [upstream] = discoverUpstreams(
        { upstreamRepo: "acme/app", upstreamVersion: "1.0.0" },
        { services: {} }
      );

      expect(upstream.arg).to.equal("UPSTREAM_VERSION");
    });

    it("returns no upstreams for a manifest without any", () => {
      expect(discoverUpstreams({}, compose)).to.deep.equal([]);
    });

    describe("with several upstreams", () => {
      const upstream = [
        { repo: "acme/a", version: "1", arg: "A" },
        { repo: "acme/b", version: "2", arg: "B" }
      ];

      it("reads every entry", () => {
        expect(discoverUpstreams({ upstream }, compose)).to.have.length(2);
      });

      it("requires each entry to name its arg", () => {
        const manifest = {
          upstream: [upstream[0], { ...upstream[1], arg: undefined }]
        };
        expect(() => discoverUpstreams(manifest, compose)).to.throw(
          "multi-upstream"
        );
      });

      it("requires unique repositories", () => {
        const manifest = {
          upstream: [upstream[0], { ...upstream[1], repo: "acme/a" }]
        };
        expect(() => discoverUpstreams(manifest, compose)).to.throw(
          "repositories must be unique"
        );
      });

      it("requires unique args", () => {
        const manifest = {
          upstream: [upstream[0], { ...upstream[1], arg: "A" }]
        };
        expect(() => discoverUpstreams(manifest, compose)).to.throw(
          "args must be unique"
        );
      });
    });

    it("fails when several version args could be the upstream arg", () => {
      const manifest = { upstreamRepo: "acme/app", upstreamVersion: "1" };
      const listArgsCompose = {
        services: { app: { build: { args: ["A_VERSION=1", "B_TAG=2"] } } }
      };

      expect(() => discoverUpstreams(manifest, listArgsCompose)).to.throw(
        "uniquely detect"
      );
    });
  });

  describe("getPackageManifestDirs", () => {
    let dir: string;

    beforeEach(() => {
      dir = temporaryDirectory();
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    function addVariants(variantsDirName: string): void {
      for (const variant of ["mainnet", "testnet"]) {
        const variantDir = path.join(dir, variantsDirName, variant);
        fs.mkdirSync(variantDir, { recursive: true });
        fs.writeFileSync(path.join(variantDir, "dappnode_package.json"), "{}");
      }
    }

    it("returns the root for a package without variants", () => {
      expect(getPackageManifestDirs(dir)).to.deep.equal([dir]);
    });

    it("returns each variant in package_variants", () => {
      addVariants("package_variants");

      const dirs = getPackageManifestDirs(dir);

      expect(dirs.map(variantDir => path.basename(variantDir))).to.deep.equal([
        "mainnet",
        "testnet"
      ]);
    });

    it("supports a custom variants directory", () => {
      addVariants("legacy");

      expect(getPackageManifestDirs(dir, "legacy")).to.have.length(2);
    });

    it("fails for a variant without manifest", () => {
      addVariants("package_variants");
      fs.unlinkSync(
        path.join(dir, "package_variants", "mainnet", "dappnode_package.json")
      );

      expect(() => getPackageManifestDirs(dir)).to.throw(
        "Variant has no manifest"
      );
    });
  });
});
