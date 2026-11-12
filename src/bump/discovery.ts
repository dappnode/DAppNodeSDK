import fs from "fs";
import path from "path";
import { Manifest } from "@dappnode/types";
import {
  defaultManifestFileName,
  defaultVariantsDirName,
  UPSTREAM_VERSION_VARNAME
} from "../params.js";
import { arrIsUnique } from "../utils/array.js";
import { getAllVariantsInPath } from "../files/variants/getAllPackageVariants.js";
import {
  BumpUpstreamItem,
  compileTagPattern,
  parseProvider,
  UpstreamProvider
} from "./metadata.js";

export interface Upstream {
  repo: string;
  version: string;
  arg: string;
  provider: UpstreamProvider;
  tagPattern?: string;
}

/**
 * The part of a compose file that upstream bumps read. Unlike the shared
 * `Compose` type, build args may use list syntax (`- ARG=value`).
 */
export interface BumpCompose {
  services: Record<string, BuildService>;
}

export interface BuildService {
  build?:
    | string
    | {
        context?: string;
        dockerfile?: string;
        args?: Record<string, unknown> | string[];
      };
}

export type BumpManifest = Partial<Manifest> & { upstreamProvider?: string };

type UpstreamEntry = Partial<BumpUpstreamItem> & { repo: string };

/**
 * Returns the build args of a compose service as [name, value] pairs, for both
 * mapping and list syntax. A list arg without `=` has a null value.
 */
export function getBuildArgs(service: BuildService): [string, unknown][] {
  if (typeof service.build !== "object" || !service.build.args) return [];

  const args = service.build.args;
  if (!Array.isArray(args)) return Object.entries(args);

  return args.map(arg => {
    const separator = arg.indexOf("=");
    if (separator < 0) return [arg.trim(), null];
    return [arg.slice(0, separator).trim(), arg.slice(separator + 1)];
  });
}

/**
 * Lists the upstreams declared in the manifest, from `upstream[]` or from the
 * legacy `upstreamRepo`, `upstreamVersion` and `upstreamArg` fields.
 */
export function discoverUpstreams(
  manifest: BumpManifest,
  compose: BumpCompose
): Upstream[] {
  const entries = getUpstreamEntries(manifest);
  const versionArgs = getVersionArgs(compose);
  const upstreams = entries.map(entry =>
    parseUpstream(entry, entries.length > 1, versionArgs)
  );

  if (!arrIsUnique(upstreams.map(({ repo }) => repo)))
    throw Error("Upstream repositories must be unique");
  if (!arrIsUnique(upstreams.map(({ arg }) => arg)))
    throw Error("Upstream args must be unique");

  return upstreams;
}

/**
 * Returns the directories whose manifest version a bump updates: each variant
 * in `variantsDirName`, or the package root when the package has no variants.
 */
export function getPackageManifestDirs(
  dir: string,
  variantsDirName = defaultVariantsDirName
): string[] {
  const variantsPath = path.resolve(dir, variantsDirName);
  if (!fs.existsSync(variantsPath)) return [dir];

  const variantDirs = getAllVariantsInPath(variantsPath).map(variant =>
    path.join(variantsPath, variant)
  );
  if (variantDirs.length === 0) return [dir];

  for (const variantDir of variantDirs) {
    if (!fs.existsSync(path.join(variantDir, defaultManifestFileName)))
      throw Error(`Variant has no manifest: ${variantDir}`);
  }

  return variantDirs;
}

function getUpstreamEntries(manifest: BumpManifest): UpstreamEntry[] {
  if (manifest.upstream) return manifest.upstream;
  if (!manifest.upstreamRepo) return [];

  return [
    {
      repo: manifest.upstreamRepo,
      version: manifest.upstreamVersion,
      arg: manifest.upstreamArg,
      provider: manifest.upstreamProvider
    }
  ];
}

/**
 * Compose build args that look like versions. They identify the arg of a
 * single upstream that does not name one.
 */
function getVersionArgs(compose: BumpCompose): string[] {
  const argNames = Object.values(compose.services).flatMap(service =>
    getBuildArgs(service).map(([name]) => name)
  );
  return [...new Set(argNames)].filter(name => /VERSION|TAG/.test(name));
}

function parseUpstream(
  entry: UpstreamEntry,
  isMultiUpstream: boolean,
  versionArgs: string[]
): Upstream {
  if (!entry.repo || !entry.version)
    throw Error("Upstream repo and version are required");

  compileTagPattern(entry.tagPattern);

  return {
    ...entry,
    version: entry.version,
    arg: entry.arg || inferUpstreamArg(isMultiUpstream, versionArgs),
    provider: parseProvider(entry.provider)
  };
}

function inferUpstreamArg(
  isMultiUpstream: boolean,
  versionArgs: string[]
): string {
  if (isMultiUpstream)
    throw Error("Every entry in a multi-upstream manifest must name an arg");
  if (versionArgs.length > 1)
    throw Error(
      `Cannot uniquely detect upstream arg: ${versionArgs.join(", ")}`
    );

  return versionArgs[0] || UPSTREAM_VERSION_VARNAME;
}
