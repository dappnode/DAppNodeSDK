import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { Manifest } from "@dappnode/types";
import {
  BumpCompose,
  discoverUpstreams,
  packageManifestDirs
} from "./discovery.js";
import {
  editCompose,
  editManifest,
  PlannedFile,
  ValueChange
} from "./edits.js";
import {
  ResolutionDependencies,
  ResolvedUpstream,
  resolveUpstream
} from "./resolve.js";

export async function resolvePackage(
  dir: string,
  dependencies: ResolutionDependencies,
  explicitVersion?: string
): Promise<ResolvedUpstream[]> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "dappnode_package.json"), "utf8")
  ) as Manifest;
  const compose = yaml.load(
    fs.readFileSync(path.join(dir, "docker-compose.yml"), "utf8")
  ) as BumpCompose;
  const upstreams = discoverUpstreams(manifest, compose);
  if (explicitVersion !== undefined && upstreams.length !== 1)
    throw Error("An explicit version requires exactly one upstream");
  const results: ResolvedUpstream[] = [];
  for (const upstream of upstreams) {
    const result = await resolveUpstream(
      dir,
      compose,
      upstream,
      dependencies,
      explicitVersion
    );
    if (result) results.push(result);
  }
  return results;
}

export async function planPackageEdits({
  dir,
  upstreams,
  nextPackageVersion,
  variantsDir
}: {
  dir: string;
  upstreams: ResolvedUpstream[];
  nextPackageVersion: (dir: string) => Promise<string>;
  variantsDir?: string;
}): Promise<PlannedFile[]> {
  const changed = upstreams.filter(item => item.targetVersion !== item.version);
  if (!changed.length) return [];
  const manifestFile = path.join(dir, "dappnode_package.json");
  const manifestText = fs.readFileSync(manifestFile, "utf8");
  const manifest = JSON.parse(manifestText) as Manifest;
  const changes: ValueChange[] = changed.map(item => {
    const index = manifest.upstream?.findIndex(
      upstream => upstream.repo === item.repo
    );
    if (manifest.upstream && (index === undefined || index < 0))
      throw Error(`Upstream '${item.repo}' is absent from root manifest`);
    return {
      path: manifest.upstream
        ? ["upstream", index!, "version"]
        : ["upstreamVersion"],
      value: item.targetVersion
    };
  });
  const plan: PlannedFile[] = [];
  for (const packageDir of packageManifestDirs(dir, variantsDir)) {
    const file = path.join(packageDir, "dappnode_package.json");
    const value = await nextPackageVersion(packageDir);
    if (path.resolve(file) === path.resolve(manifestFile))
      changes.push({ path: ["version"], value });
    else {
      const before = fs.readFileSync(file, "utf8");
      plan.push({
        path: file,
        before,
        after: editManifest(before, [{ path: ["version"], value }])
      });
    }
  }
  plan.push({
    path: manifestFile,
    before: manifestText,
    after: editManifest(manifestText, changes)
  });
  const composeFile = path.join(dir, "docker-compose.yml");
  const before = fs.readFileSync(composeFile, "utf8");
  plan.push({
    path: composeFile,
    before,
    after: editCompose(
      before,
      new Map(changed.map(item => [item.arg, item.composeValue]))
    )
  });
  return plan;
}
