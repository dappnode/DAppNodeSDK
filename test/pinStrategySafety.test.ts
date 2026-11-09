import fs from "fs";
import { execFileSync } from "child_process";
import path from "path";
import { mock } from "node:test";
import { expect } from "chai";
import Listr from "listr";
import { fetchPinsWithBranchToDelete } from "../src/pinStrategy/index.js";
import { PinataPinManager } from "../src/providers/pinata/pinManager.js";
import { Github } from "../src/providers/github/Github.js";
import {
  cleanPinsFromDeletedBranches,
  getPackageManifestsToClean
} from "../src/commands/githubActions/build/cleanPinsFromDeletedBranches.js";
import { getDeleteOldPinsTask } from "../src/tasks/buildAndUpload/getDeleteOldPinsTask.js";
import {
  executable,
  temporaryDirectory,
  useExecutables
} from "./helpers/fixtures.js";

const manifest = { name: "demo.public.dappnode.eth", version: "0.1.0" };
describe("safe pin cleanup", () => {
  let dir: string;
  let restorePath: () => void;
  const originalKey = process.env.PINATA_API_KEY;
  const originalSecret = process.env.PINATA_SECRET_API_KEY;
  beforeEach(() => {
    dir = temporaryDirectory();
    fs.writeFileSync(
      path.join(dir, "dappnode_package.json"),
      JSON.stringify(manifest)
    );
    executable(
      dir,
      "git",
      `const args = process.argv.slice(2); if (args[0] === 'merge-base') process.exit(args[2] === '1111111' ? 0 : 1); console.log(args.includes('--abbrev-ref') ? 'feature' : '2222222');`
    );
    restorePath = useExecutables(dir);
    process.env.PINATA_API_KEY = "fake";
    process.env.PINATA_SECRET_API_KEY = "fake";
  });
  afterEach(() => {
    mock.restoreAll();
    restorePath();
    fs.rmSync(dir, { recursive: true, force: true });
    if (originalKey === undefined) delete process.env.PINATA_API_KEY;
    else process.env.PINATA_API_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.PINATA_SECRET_API_KEY;
    else process.env.PINATA_SECRET_API_KEY = originalSecret;
  });

  it("only deletes known ancestor commits, preserving concurrent newer builds", async () => {
    const pinata = {
      pinList: async () =>
        ["1111111", "2222222", "3333333", "invalid"].map(commit => ({
          ipfs_pin_hash: commit,
          metadata: { keyvalues: { commit } }
        }))
    } as unknown as PinataPinManager;
    const pins = await fetchPinsWithBranchToDelete(
      pinata,
      manifest,
      { branch: "feature", commit: "2222222" },
      dir
    );
    expect(pins.map(pin => pin.commit)).to.deep.equal(["1111111"]);
  });

  it("rechecks allegedly deleted branches before unpinning", async () => {
    mock.method(Github, "fromLocal", () => ({
      listBranches: async () => [],
      branchExists: async (branch: string) => branch === "active"
    }));
    mock.method(PinataPinManager.prototype, "pinList", async () =>
      ["active", "removed"].map(branch => ({
        ipfs_pin_hash: branch,
        metadata: { keyvalues: { branch, commit: "1111111" } }
      }))
    );
    const removed: string[] = [];
    mock.method(PinataPinManager.prototype, "unpin", async (hash: string) => {
      removed.push(hash);
    });
    await cleanPinsFromDeletedBranches({ dir });
    expect(removed).to.deep.equal(["removed"]);
  });

  it("does not delete old pins if no replacement was uploaded", async () => {
    let lookedUp = false;
    mock.method(PinataPinManager.prototype, "pinList", async () => {
      lookedUp = true;
      return [];
    });
    await new Listr(
      [
        getDeleteOldPinsTask({
          packagesToBuildProps: [
            { manifest, manifestPaths: [{ dir }] }
          ] as never,
          deleteOldPins: true,
          releaseUploaderProvider: {
            network: "ipfs",
            type: "pinata",
            apiKey: "fake",
            secretApiKey: "fake"
          }
        })
      ],
      { renderer: "silent" }
    ).run({});
    expect(lookedUp).to.equal(false);
  });
});

describe("old pin cleanup on shallow CI checkouts", function () {
  this.timeout(30000);
  let root: string;
  const git = (cwd: string, ...args: string[]): string =>
    execFileSync(
      "git",
      ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false", ...args],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "test",
          GIT_AUTHOR_EMAIL: "test@example.com",
          GIT_COMMITTER_NAME: "test",
          GIT_COMMITTER_EMAIL: "test@example.com"
        }
      }
    ).trim();

  beforeEach(() => (root = temporaryDirectory()));
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("fetches missing history so ancestor pins are deleted, never unknown ones", async () => {
    const origin = path.join(root, "origin");
    fs.mkdirSync(origin);
    git(origin, "init", "--quiet", "--initial-branch=feature");
    const commits: string[] = [];
    for (const n of [1, 2, 3]) {
      fs.writeFileSync(path.join(origin, "file"), String(n));
      git(origin, "add", "file");
      git(origin, "commit", "--quiet", "-m", `commit ${n}`);
      commits.push(git(origin, "rev-parse", "HEAD"));
    }
    const clone = path.join(root, "clone");
    git(root, "clone", "--quiet", "--depth=1", `file://${origin}`, clone);
    expect(git(clone, "rev-parse", "--is-shallow-repository")).to.equal("true");

    const foreign = "f".repeat(40);
    const pinata = {
      pinList: async () =>
        [...commits, foreign].map(commit => ({
          ipfs_pin_hash: commit,
          metadata: { keyvalues: { commit } }
        }))
    } as unknown as PinataPinManager;
    const pins = await fetchPinsWithBranchToDelete(
      pinata,
      manifest,
      { branch: "feature", commit: commits[2] },
      clone
    );
    expect(pins.map(pin => pin.commit)).to.deep.equal(commits.slice(0, 2));
  });
});

describe("branch pin cleanup for template packages", () => {
  let dir: string;
  const write = (rel: string, data: object) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), JSON.stringify(data));
  };
  beforeEach(() => {
    dir = temporaryDirectory();
    // Same shape as DAppNodePackage-juno-generic: a named root, a variant that
    // inherits the name and one that overrides it.
    write("dappnode_package.json", { name: "juno.dnp.dappnode.eth" });
    write("package_variants/mainnet/dappnode_package.json", {
      name: "juno.dnp.dappnode.eth",
      version: "0.1.0"
    });
    write("package_variants/sepolia/dappnode_package.json", {
      name: "juno-sepolia.dnp.dappnode.eth",
      version: "0.1.0"
    });
  });
  afterEach(() => {
    mock.restoreAll();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("finds variant package names even when the root manifest has a name", () => {
    expect(
      getPackageManifestsToClean({ dir }).map(manifest => manifest.name)
    ).to.deep.equal(["juno.dnp.dappnode.eth", "juno-sepolia.dnp.dappnode.eth"]);
  });

  it("uses only variant names when the root manifest has none", () => {
    write("dappnode_package.json", { upstreamRepo: "x/y" });
    expect(
      getPackageManifestsToClean({ dir }).map(manifest => manifest.name)
    ).to.deep.equal(["juno.dnp.dappnode.eth", "juno-sepolia.dnp.dappnode.eth"]);
  });

  it("unpins deleted-branch pins of every variant package", async () => {
    const original = {
      key: process.env.PINATA_API_KEY,
      secret: process.env.PINATA_SECRET_API_KEY
    };
    process.env.PINATA_API_KEY = "fake";
    process.env.PINATA_SECRET_API_KEY = "fake";
    mock.method(Github, "fromLocal", () => ({
      listBranches: async () => [{ name: "main" }],
      branchExists: async (branch: string) => branch === "main"
    }));
    const queried: string[] = [];
    mock.method(
      PinataPinManager.prototype,
      "pinList",
      async (filters: { keyvalues: { dnpName: { value: string } } }) => {
        const dnpName = filters.keyvalues.dnpName.value;
        queried.push(dnpName);
        return [
          {
            ipfs_pin_hash: `${dnpName}-deleted`,
            metadata: {
              keyvalues: { dnpName, branch: "deleted", commit: "1111111" }
            }
          }
        ];
      }
    );
    const removed: string[] = [];
    mock.method(PinataPinManager.prototype, "unpin", async (hash: string) => {
      removed.push(hash);
    });
    try {
      await cleanPinsFromDeletedBranches({ dir });
    } finally {
      if (original.key === undefined) delete process.env.PINATA_API_KEY;
      else process.env.PINATA_API_KEY = original.key;
      if (original.secret === undefined)
        delete process.env.PINATA_SECRET_API_KEY;
      else process.env.PINATA_SECRET_API_KEY = original.secret;
    }
    expect(queried).to.deep.equal([
      "juno.dnp.dappnode.eth",
      "juno-sepolia.dnp.dappnode.eth"
    ]);
    expect(removed).to.deep.equal([
      "juno.dnp.dappnode.eth-deleted",
      "juno-sepolia.dnp.dappnode.eth-deleted"
    ]);
  });
});
