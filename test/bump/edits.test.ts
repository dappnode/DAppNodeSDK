import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import {
  editCompose,
  editManifest,
  validateEdits,
  writePlan
} from "../../src/bump/edits.js";
import { planPackageEdits, resolvePackage } from "../../src/bump/plan.js";
import {
  ResolvedUpstream,
  ResolutionDependencies
} from "../../src/bump/resolve.js";
import { temporaryDirectory } from "../helpers/fixtures.js";

const upstream: ResolvedUpstream = {
  repo: "acme/app",
  arg: "VERSION",
  provider: "github",
  version: "v1.0.0",
  targetVersion: "v2.0.0",
  composeValue: "v2.0.0"
};
const compose =
  "# header\nservices:\n  app:\n    build:\n      args: {VERSION: \"v1.0.0\", STATIC: keep} # comment\n  worker:\n    build:\n      args:\n        - 'VERSION=v1.0.0' # worker\n        - OTHER=keep\n";

describe("bump / edits", () => {
  it("preserves mapping/list args, quotes, comments, flow styles, CRLF and unrelated bytes", () => {
    for (const before of [compose, compose.replace(/\n/g, "\r\n")]) {
      const after = editCompose(before, new Map([["VERSION", "v2.0.0"]]));
      expect(after).to.equal(before.replace(/v1\.0\.0/g, "v2.0.0"));
      expect(editCompose(after, new Map([["VERSION", "v2.0.0"]]))).to.equal(
        after
      );
    }
    const flow = "services: {app: {build: {args: [VERSION=v1.0.0, X=keep]}}}\n";
    expect(editCompose(flow, new Map([["VERSION", "v2.0.0"]]))).to.equal(
      flow.replace("v1.0.0", "v2.0.0")
    );
  });

  it("preserves plain scalars and quotes newly ambiguous strings", () => {
    const plain =
      "services:\n  app:\n    build:\n      args:\n        VERSION: v1.0.0\n";
    expect(editCompose(plain, new Map([["VERSION", "true"]]))).to.equal(
      plain.replace("v1.0.0", '"true"')
    );
    expect(editCompose(plain, new Map([["VERSION", "v2.0.0"]]))).to.equal(
      plain.replace("v1.0.0", "v2.0.0")
    );
  });

  it("preserves JSON key order, indentation, spacing and trailing newline", () => {
    for (const newline of ["", "\n", "\r\n"]) {
      const before =
        '{\n\t"upstream": [{"repo":"acme/app", "version": "v1.0.0"}],\n\t"version":"0.1.0",\n\t"name":"app"\n}' +
        newline;
      expect(
        editManifest(before, [
          { path: ["upstream", 0, "version"], value: "v2.0.0" },
          { path: ["version"], value: "0.1.1" }
        ])
      ).to.equal(before.replace("v1.0.0", "v2.0.0").replace("0.1.0", "0.1.1"));
    }
    const legacy = '{"upstreamVersion":"v1.0.0","version":"0.1.0"}\n';
    expect(
      editManifest(legacy, [{ path: ["upstreamVersion"], value: "v2.0.0" }])
    ).to.equal(legacy.replace("v1.0.0", "v2.0.0"));
  });

  it("rejects unintended edits, incomplete updates, duplicate keys and aliases", () => {
    const changes = [
      { path: ["services", "app", "build", "args", "VERSION"], value: "v2.0.0" }
    ];
    expect(() =>
      validateEdits(
        compose,
        compose.replace("STATIC: keep", "STATIC: bad"),
        changes
      )
    ).to.throw("outside the intended");
    expect(() => validateEdits(compose, compose, changes)).to.throw(
      "outside the intended"
    );
    expect(() =>
      editCompose(
        "services: {app: &build {build: {args: {VERSION: v1}}}, worker: *build}",
        new Map([["VERSION", "v2"]])
      )
    ).to.throw("Aliases");
    expect(() =>
      editCompose(
        "services: {app: {build: {args: {VERSION: v1, VERSION: v2}}}}",
        new Map([["VERSION", "v3"]])
      )
    ).to.throw();
  });

  it("plans root upstream edits and bumps every variant, with idempotent re-runs", async () => {
    const dir = temporaryDirectory();
    try {
      fs.writeFileSync(
        path.join(dir, "dappnode_package.json"),
        JSON.stringify(
          {
            upstream: [
              {
                repo: "acme/app",
                version: "v1.0.0",
                arg: "VERSION",
                provider: "github"
              }
            ]
          },
          null,
          2
        ) + "\n"
      );
      fs.writeFileSync(path.join(dir, "docker-compose.yml"), compose);
      for (const variant of ["mainnet", "testnet"]) {
        const base = path.join(dir, "package_variants", variant);
        fs.mkdirSync(base, { recursive: true });
        fs.writeFileSync(
          path.join(base, "dappnode_package.json"),
          '{"name":"app","version":"0.1.0"}\n'
        );
      }
      const plan = await planPackageEdits({
        dir,
        upstreams: [upstream],
        nextPackageVersion: async () => "0.1.1"
      });
      expect(plan).to.have.length(4);
      expect(
        fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8")
      ).to.equal(compose);
      writePlan(plan);
      expect(
        JSON.parse(
          fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
        )
      ).not.to.have.property("version");
      for (const variant of ["mainnet", "testnet"])
        expect(
          fs.readFileSync(
            path.join(
              dir,
              "package_variants",
              variant,
              "dappnode_package.json"
            ),
            "utf8"
          )
        ).to.equal('{"name":"app","version":"0.1.1"}\n');
      const dependencies: ResolutionDependencies = {
        latestRelease: async () => "v2.0.0",
        registry: {
          tagExists: async () => {
            throw Error("registry must not be called");
          },
          manifestDigest: async () => {
            throw Error("registry must not be called");
          },
          latestTag: async () => null
        }
      };
      const resolved = await resolvePackage(dir, dependencies);
      const beforeStats = plan.map(file => fs.statSync(file.path).mtimeMs);
      const again = await planPackageEdits({
        dir,
        upstreams: resolved,
        nextPackageVersion: async () => {
          throw Error("must not bump twice");
        }
      });
      writePlan(again);
      expect(again).to.deep.equal([]);
      expect(plan.map(file => fs.statSync(file.path).mtimeMs)).to.deep.equal(
        beforeStats
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves all files unchanged if a later package-version lookup fails", async () => {
    const dir = temporaryDirectory();
    try {
      const before = JSON.stringify({
        version: "0.1.0",
        upstreamRepo: "acme/app",
        upstreamVersion: "v1.0.0"
      });
      const file = path.join(dir, "dappnode_package.json");
      fs.writeFileSync(file, before);
      fs.writeFileSync(path.join(dir, "docker-compose.yml"), compose);
      for (const variant of ["first", "second"]) {
        const base = path.join(dir, "package_variants", variant);
        fs.mkdirSync(base, { recursive: true });
        fs.writeFileSync(
          path.join(base, "dappnode_package.json"),
          '{"version":"0.1.0"}\n'
        );
      }
      let lookups = 0;
      let failure: Error | undefined;
      try {
        await planPackageEdits({
          dir,
          upstreams: [upstream],
          nextPackageVersion: async () => {
            if (++lookups === 1) return "0.1.1";
            throw Error("APM unavailable");
          }
        });
      } catch (error) {
        failure = error;
      }
      expect(failure?.message).to.equal("APM unavailable");
      expect(lookups).to.equal(2);
      for (const variant of ["first", "second"])
        expect(
          fs.readFileSync(
            path.join(
              dir,
              "package_variants",
              variant,
              "dappnode_package.json"
            ),
            "utf8"
          )
        ).to.equal('{"version":"0.1.0"}\n');
      expect(fs.readFileSync(file, "utf8")).to.equal(before);
      expect(
        fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8")
      ).to.equal(compose);
      expect(() =>
        writePlan([{ path: file, before: "stale", after: "bad" }])
      ).to.throw("File changed");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves the checkout untouched if digest resolution fails", async () => {
    const dir = temporaryDirectory();
    const digest = `sha256:${"a".repeat(64)}`;
    const beforeManifest = JSON.stringify({
      name: "app.dnp.dappnode.eth",
      version: "0.1.0",
      upstream: [{ repo: "acme/app", version: "v1.0.0", arg: "VERSION" }]
    });
    const beforeCompose = compose.replace(/v1\.0\.0/g, `v1.0.0@${digest}`);
    try {
      fs.writeFileSync(path.join(dir, "dappnode_package.json"), beforeManifest);
      fs.writeFileSync(path.join(dir, "docker-compose.yml"), beforeCompose);
      let failure: Error | undefined;
      try {
        const upstreams = await resolvePackage(dir, {
          latestRelease: async () => "v2.0.0",
          imageSource: () => ({ image: "org/app", template: "{version}" }),
          registry: {
            tagExists: async () => true,
            latestTag: async () => null,
            manifestDigest: async () => {
              throw Error("Registry pinning unavailable");
            }
          }
        });
        writePlan(
          await planPackageEdits({
            dir,
            upstreams,
            nextPackageVersion: async () => "0.1.1"
          })
        );
      } catch (error) {
        failure = error;
      }
      expect(failure?.message).to.equal("Registry pinning unavailable");
      expect(
        fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
      ).to.equal(beforeManifest);
      expect(
        fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8")
      ).to.equal(beforeCompose);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
