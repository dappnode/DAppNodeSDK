/** Manual network check: node --import=tsx test/bump/compareEngines.ts --workspace <clone> [--version <tag>] */
import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import assert from "node:assert/strict";
import semver from "semver";
import { packageManifestDirs } from "../../src/bump/discovery.js";
import { editManifest, writePlan } from "../../src/bump/edits.js";
import { planPackageEdits, resolvePackage } from "../../src/bump/plan.js";
import { RegistryClient } from "../../src/bump/registry.js";
import { selectLatestRelease } from "../../src/commands/githubActions/bumpUpstream/github/pickLatestRelease.js";

const { values } = parseArgs({
  options: {
    workspace: { type: "string" },
    version: { type: "string" }
  }
});
if (!values.workspace) throw Error("--workspace is required");
const original = path.resolve(values.workspace);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-bump-compare-"));
const sdk = path.join(scratch, "sdk");
const reference = path.join(scratch, "reference");
for (const destination of [sdk, reference])
  fs.cpSync(original, destination, { recursive: true });
const dependencies = {
  registry: new RegistryClient(),
  latestRelease: async (repo: string, pattern?: string) => {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json"
    };
    if (process.env.GITHUB_TOKEN)
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const get = async (url: string) => {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/${url}`,
        {
          headers
        }
      );
      if (response.status === 404) return null;
      if (response.status !== 200)
        throw Error(`GitHub release lookup returned ${response.status}`);
      return response.json();
    };
    return selectLatestRelease(
      await get("releases/latest"),
      async () => (await get("releases?per_page=30")) || [],
      pattern
    );
  }
};
const resolved = await resolvePackage(sdk, dependencies, values.version);
const plan = await planPackageEdits({
  dir: sdk,
  upstreams: resolved,
  // A deterministic stand-in for the APM lookup; only this extra package bump
  // is reversed below before comparing upstream edits byte for byte.
  nextPackageVersion: async dir => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
    );
    const next = semver.inc(manifest.version, "patch");
    if (!next) throw Error("Invalid package version");
    return next;
  }
});
writePlan(plan);
const dockerArgs = [
  "run",
  "--rm",
  "-v",
  `${reference}:/workspace`,
  "-w",
  "/workspace",
  "-e",
  "GITHUB_TOKEN",
  "docker.io/dappnode/tropibot:latest",
  "bump-runner",
  "update",
  "--format",
  "json"
];
if (values.version) dockerArgs.push("--version", values.version);
const referenceOutput = execFileSync("docker", dockerArgs, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 180000
});
fs.writeFileSync(path.join(scratch, "reference.json"), referenceOutput);
const packageManifests = packageManifestDirs(sdk).map(dir =>
  path.relative(sdk, path.join(dir, "dappnode_package.json"))
);
const files = [
  ...new Set([
    "dappnode_package.json",
    "docker-compose.yml",
    ...packageManifests
  ])
];
for (const file of files) {
  let actual = fs.readFileSync(path.join(sdk, file), "utf8");
  const expected = fs.readFileSync(path.join(reference, file), "utf8");
  if (packageManifests.includes(file) && plan.length) {
    const originalVersion = JSON.parse(
      fs.readFileSync(path.join(original, file), "utf8")
    ).version;
    assert.equal(
      JSON.parse(actual).version,
      semver.inc(originalVersion, "patch")
    );
    actual = editManifest(actual, [
      { path: ["version"], value: originalVersion }
    ]);
  }
  assert.equal(actual, expected, `Byte mismatch: ${file}; inspect ${scratch}`);
}
const mtimes = files.map(file => fs.statSync(path.join(sdk, file)).mtimeMs);
const rerun = await resolvePackage(sdk, dependencies, values.version);
const rerunPlan = await planPackageEdits({
  dir: sdk,
  upstreams: rerun,
  nextPackageVersion: async () => {
    throw Error("Idempotent rerun must not bump package");
  }
});
assert.deepEqual(rerunPlan, []);
assert.deepEqual(
  files.map(file => fs.statSync(path.join(sdk, file)).mtimeMs),
  mtimes
);
console.log(
  JSON.stringify(
    {
      workspace: original,
      request: values.version || "latest",
      results: resolved.map(item => ({
        repo: item.repo,
        previous: item.version,
        version: item.targetVersion,
        compose: item.composeValue
      })),
      compared: files,
      packageVersionBumps: plan.length ? packageManifests.length : 0,
      byteIdentical: true,
      idempotent: true,
      scratch
    },
    null,
    2
  )
);
