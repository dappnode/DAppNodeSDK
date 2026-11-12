import fs from "node:fs";
import path from "node:path";
import { Manifest } from "@dappnode/types";
import {
  BumpUpstreamItem,
  compileTagPattern,
  parseProvider,
  Provider
} from "./metadata.js";

export interface Upstream {
  repo: string;
  version: string;
  arg: string;
  provider: Provider;
  tagPattern?: string;
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
export interface BumpCompose {
  services: Record<string, BuildService>;
}

export function buildArgs(service: BuildService): [string, unknown][] {
  const args =
    typeof service.build === "object" ? service.build.args : undefined;
  return Array.isArray(args)
    ? args.map(item => {
        const split = item.indexOf("=");
        return split < 0
          ? [item.trim(), null]
          : [item.slice(0, split).trim(), item.slice(split + 1)];
      })
    : Object.entries(args || {});
}

export function discoverUpstreams(
  manifest: Partial<Manifest> & { upstreamProvider?: string },
  compose: BumpCompose
): Upstream[] {
  const entries: (Partial<BumpUpstreamItem> & { repo: string })[] =
    manifest.upstream ??
    (manifest.upstreamRepo
      ? [
          {
            repo: manifest.upstreamRepo,
            version: manifest.upstreamVersion,
            arg: manifest.upstreamArg,
            provider: manifest.upstreamProvider
          }
        ]
      : []);
  const named = [
    ...new Set(
      Object.values(compose.services)
        .flatMap(service => buildArgs(service).map(([arg]) => arg))
        .filter(arg => /VERSION|TAG/.test(arg))
    )
  ];
  const result = entries.map(entry => {
    if (!entry.repo || !entry.version)
      throw Error("Upstream repo and version are required");
    if (entries.length > 1 && !entry.arg)
      throw Error("Every entry in a multi-upstream manifest must name an arg");
    if (!entry.arg && named.length > 1)
      throw Error(`Cannot uniquely detect upstream arg: ${named.join(", ")}`);
    compileTagPattern(entry.tagPattern);
    return {
      ...entry,
      version: entry.version,
      arg: entry.arg || named[0] || "UPSTREAM_VERSION",
      provider: parseProvider(entry.provider)
    };
  });
  for (const key of ["repo", "arg"] as const)
    if (new Set(result.map(entry => entry[key])).size !== result.length)
      throw Error(
        `Upstream ${key === "repo" ? "repositories" : "args"} must be unique`
      );
  return result;
}

export function packageManifestDirs(
  dir: string,
  variantsDir = "package_variants"
): string[] {
  for (const name of [...new Set([variantsDir, "package_variants"])]) {
    const base = path.resolve(dir, name);
    if (!fs.existsSync(base)) continue;
    const dirs = fs
      .readdirSync(base, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(base, entry.name));
    if (dirs.length) {
      for (const variant of dirs)
        if (!fs.existsSync(path.join(variant, "dappnode_package.json")))
          throw Error(`Variant has no manifest: ${variant}`);
      return dirs;
    }
  }
  return [dir];
}
