import { expect } from "chai";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { recoverBumpBranch } from "../../../src/commands/githubActions/bumpUpstream/github/index.js";

const branchName = "dappnodebot/bump-upstream/org/repo@1.2.0";

/** Temp dir of the test in progress, removed after it. */
let root: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * A bare "origin" holding the default branch and a pushed bump branch, and a
 * fresh clone of it on the default branch, as a CI checkout would be.
 */
function setupRepos(): { clone: string; bumpCommit: string } {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "recover-bump-"));
  const origin = path.join(root, "origin.git");
  const work = path.join(root, "work");
  const clone = path.join(root, "clone");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, work);
  git(work, "config", "user.email", "test@example.com");
  git(work, "config", "user.name", "test");
  fs.writeFileSync(path.join(work, "dappnode_package.json"), '{"version":"0.1.0"}\n');
  git(work, "add", ".");
  git(work, "commit", "-q", "-m", "init");
  git(work, "push", "-q", "origin", "main");
  git(work, "checkout", "-q", "-b", branchName);
  fs.writeFileSync(path.join(work, "dappnode_package.json"), '{"version":"0.1.1"}\n');
  git(work, "commit", "-q", "-am", "bump org/repo to 1.2.0");
  git(work, "push", "-q", "origin", branchName);
  const bumpCommit = git(work, "rev-parse", "HEAD");
  git(root, "clone", "-q", "-b", "main", origin, clone);
  return { clone, bumpCommit };
}

describe("command / gaBumpUpstream / recoverBumpBranch", function () {
  this.timeout(30 * 1000);

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("checks out the pushed branch and opens its PR", async () => {
    const { clone, bumpCommit } = setupRepos();
    let opened = 0;
    await recoverBumpBranch({
      dir: clone,
      branchName,
      skipCommit: false,
      openPr: async () => {
        opened++;
      }
    });
    expect(git(clone, "rev-parse", "HEAD")).to.equal(bumpCommit);
    expect(git(clone, "rev-parse", "--abbrev-ref", "HEAD")).to.equal(branchName);
    expect(opened).to.equal(1);
  });

  it("checks out the branch but opens no PR when SKIP_COMMIT is set", async () => {
    const { clone, bumpCommit } = setupRepos();
    let opened = 0;
    await recoverBumpBranch({
      dir: clone,
      branchName,
      skipCommit: true,
      openPr: async () => {
        opened++;
      }
    });
    expect(git(clone, "rev-parse", "HEAD")).to.equal(bumpCommit);
    expect(opened).to.equal(0);
  });
});
