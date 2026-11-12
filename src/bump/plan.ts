import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { defaultComposeFileName, defaultManifestFileName } from "../params.js";
import {
  BumpCompose,
  BumpManifest,
  discoverUpstreams,
  getPackageManifestDirs
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

/**
 * Resolves the target version of each upstream of the package in `dir`.
 * Upstreams without a qualifying release are left out.
 */
export async function resolvePackage(
  dir: string,
  dependencies: ResolutionDependencies,
  explicitVersion?: string
): Promise<ResolvedUpstream[]> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, defaultManifestFileName), "utf8")
  ) as BumpManifest;
  const compose = yaml.load(
    fs.readFileSync(path.join(dir, defaultComposeFileName), "utf8")
  ) as BumpCompose;

  const upstreams = discoverUpstreams(manifest, compose);
  if (explicitVersion !== undefined && upstreams.length !== 1)
    throw Error("An explicit version requires exactly one upstream");

  const resolvedUpstreams: ResolvedUpstream[] = [];
  for (const upstream of upstreams) {
    const resolved = await resolveUpstream(
      dir,
      compose,
      upstream,
      dependencies,
      explicitVersion
    );
    if (resolved) resolvedUpstreams.push(resolved);
  }

  return resolvedUpstreams;
}

/**
 * Plans the file edits of a bump: the upstream versions in the root manifest,
 * the next package version in each package manifest (root or variants), and
 * the compose build args. Returns no edits when every upstream is current.
 */
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
  const changedUpstreams = upstreams.filter(
    upstream => upstream.targetVersion !== upstream.version
  );
  if (changedUpstreams.length === 0) return [];

  const manifestPath = path.join(dir, defaultManifestFileName);
  const manifestText = fs.readFileSync(manifestPath, "utf8");
  const rootChanges = getUpstreamVersionChanges(
    JSON.parse(manifestText),
    changedUpstreams
  );
  const plan: PlannedFile[] = [];

  for (const packageDir of getPackageManifestDirs(dir, variantsDir)) {
    const versionChange = {
      path: ["version"],
      value: await nextPackageVersion(packageDir)
    };
    if (path.resolve(packageDir) === path.resolve(dir)) {
      rootChanges.push(versionChange);
    } else {
      const variantManifestPath = path.join(
        packageDir,
        defaultManifestFileName
      );
      plan.push(
        planFileEdit(variantManifestPath, text =>
          editManifest(text, [versionChange])
        )
      );
    }
  }

  plan.push({
    path: manifestPath,
    before: manifestText,
    after: editManifest(manifestText, rootChanges)
  });

  const composeUpdates = new Map(
    changedUpstreams.map(upstream => [upstream.arg, upstream.composeValue])
  );
  plan.push(
    planFileEdit(path.join(dir, defaultComposeFileName), text =>
      editCompose(text, composeUpdates)
    )
  );

  return plan;
}

/**
 * Manifest changes that set each upstream's new version, in `upstream[]` or in
 * the legacy `upstreamVersion` field.
 */
function getUpstreamVersionChanges(
  manifest: BumpManifest,
  upstreams: ResolvedUpstream[]
): ValueChange[] {
  return upstreams.map(upstream => {
    if (!manifest.upstream)
      return { path: ["upstreamVersion"], value: upstream.targetVersion };

    const index = manifest.upstream.findIndex(
      ({ repo }) => repo === upstream.repo
    );
    if (index < 0)
      throw Error(`Upstream '${upstream.repo}' is absent from root manifest`);

    return {
      path: ["upstream", index, "version"],
      value: upstream.targetVersion
    };
  });
}

function planFileEdit(
  filePath: string,
  edit: (text: string) => string
): PlannedFile {
  const before = fs.readFileSync(filePath, "utf8");
  return { path: filePath, before, after: edit(before) };
}
