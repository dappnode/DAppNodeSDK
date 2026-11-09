import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { createRequire } from "module";
import { Compose, Manifest, releaseFiles } from "@dappnode/types";
import { PackageToBuildProps } from "../types.js";
import { defaultComposeFileName, defaultVariantsDirName } from "../params.js";
import { parseGithubRepoSlug } from "../files/manifest/getRepoSlugFromManifest.js";
import { shell } from "../utils/shell.js";
import { SpecFinding, SpecRuleId } from "./rules.js";

const manifestFileName = "dappnode_package.json";
const packageNamePattern =
  /^[a-z0-9]+(-[a-z0-9]+)*\.(dnp|public)\.dappnode\.eth$/;
const variantNamePattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Supported by DAPPMANAGER but not yet in the published manifest schema. */
const knownUnreleasedManifestFields = ["upnpDisable"];
/** Single release files that are copied (not merged) from the root or the variant. */
const singleCopiedReleaseFiles = [
  "avatar",
  "prometheusTargets",
  "disclaimer",
  "gettingStarted",
  "setupSchema",
  "setupTarget",
  "setupUiJson",
  "signature"
] as const;
/** Names that look like a release file of the given type; the type's regex decides if it is used. */
const lookalikes: {
  type: keyof typeof releaseFiles;
  pattern: RegExp;
  expected: string;
}[] = [
  {
    type: "notifications",
    pattern: /notifications\.[a-z]+$/i,
    expected: "notifications.yaml"
  },
  {
    type: "gettingStarted",
    pattern: /getting[-_ ]?started(\.[a-z]+)?$/i,
    expected: "getting-started.md"
  },
  {
    type: "disclaimer",
    pattern: /disclaimer(\.[a-z]+)?$/i,
    expected: "disclaimer.md"
  },
  {
    type: "avatar",
    pattern: /avatar.*\.(jpe?g|svg|webp|gif|ico)$/i,
    expected: "avatar.png"
  },
  {
    type: "setupWizard",
    pattern: /setup[-_]?wizard.*\.[a-z]+$/i,
    expected: "setup-wizard.json or setup-wizard.yml"
  },
  {
    type: "prometheusTargets",
    pattern: /prometheus[-_]?targets?.*\.[a-z]+$/i,
    expected: "prometheus-targets.json"
  },
  {
    type: "grafanaDashboards",
    pattern: /grafana[-_]?dashboard.*\.[a-z]+$/i,
    expected: "<name>-grafana-dashboard.json"
  }
];

export interface SpecCheckInput {
  rootDir: string;
  variantsDirPath?: string;
  composeFileName?: string;
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
  /** GitHub "owner/repo" of the package repository, if known. */
  repoSlug?: string | null;
  env?: NodeJS.ProcessEnv;
}

/**
 * Checks a package against the stricter package spec and returns every violation.
 * It never throws for a spec violation; unreadable files are reported by validation.
 */
export function checkPackageSpec({
  rootDir,
  variantsDirPath = path.join(rootDir, defaultVariantsDirName),
  composeFileName = defaultComposeFileName,
  packagesToBuildProps,
  skipComposeValidation,
  repoSlug,
  env = process.env
}: SpecCheckInput): SpecFinding[] {
  const findings: SpecFinding[] = [];
  const add = (rule: SpecRuleId, message: string, file?: string) =>
    findings.push({ rule, message, file });

  const variantDirs = listVariantDirs(variantsDirPath);
  const isTemplate = variantDirs.length > 0;
  const sourceDirs = [rootDir, ...variantDirs.map(v => v.dir)];
  const rootManifest = readRawManifest(rootDir);

  // --- Build inputs
  if (skipComposeValidation)
    add(
      "SPEC-B01",
      "Compose validation was skipped with --skip_compose_validation; DAPPMANAGER validates the compose again at install."
    );
  if (env.UPSTREAM_VERSION)
    add(
      "SPEC-B02",
      "The UPSTREAM_VERSION environment variable is set; declare the upstream version in the manifest and compose instead."
    );
  if (composeFileName !== defaultComposeFileName)
    add(
      "SPEC-C01",
      `The compose file is "${composeFileName}"; releases need ${defaultComposeFileName} (DAPPMANAGER only recognises compose*.yml).`
    );

  // --- Per source directory (root and each variant)
  for (const dir of sourceDirs) {
    const files = listFiles(dir);
    const manifests = files.filter(file =>
      releaseFiles.manifest.regex.test(file)
    );
    if (manifests.length > 1)
      add(
        "SPEC-M01",
        `Several manifest files: ${manifests.join(
          ", "
        )}. Keep only ${manifestFileName}.`,
        path.join(dir, manifests[0])
      );
    else if (manifests.length === 1 && manifests[0] !== manifestFileName)
      add(
        "SPEC-M01",
        `Manifest is "${manifests[0]}"; rename it to ${manifestFileName}.`,
        path.join(dir, manifests[0])
      );

    const isReleaseFile = (file: string) =>
      Object.values(releaseFiles).some(spec => spec.regex.test(file));
    for (const file of files.filter(file => !isReleaseFile(file)))
      for (const { type, pattern, expected } of lookalikes)
        if (pattern.test(file))
          add(
            "SPEC-F01",
            `"${file}" looks like the ${type} release file but does not match its name pattern, so it is left out of the release; rename it to ${expected}.`,
            path.join(dir, file)
          );

    for (const [type, spec] of Object.entries(releaseFiles)) {
      if (type === "manifest" || type === "compose") continue;
      for (const file of files.filter(file => spec.regex.test(file))) {
        const size = fs.statSync(path.join(dir, file)).size;
        if (size > spec.maxSize)
          add(
            "SPEC-F02",
            `"${file}" is ${formatSize(
              size
            )}; the ${type} limit is ${formatSize(spec.maxSize)}.`,
            path.join(dir, file)
          );
      }
    }

    const raw = readRawManifest(dir);
    if (raw) {
      const legacy = ["upstreamRepo", "upstreamVersion", "upstreamArg"].filter(
        key => key in raw.manifest
      );
      if (legacy.length > 0)
        add(
          "SPEC-M03",
          `Uses the legacy ${legacy.join(
            "/"
          )} field(s); declare "upstream": [{ "repo", "version", "arg" }] instead.`,
          raw.file
        );
      const known = getManifestSchemaFields();
      const unknown = Object.keys(raw.manifest).filter(key => !known.has(key));
      if (unknown.length > 0)
        add(
          "SPEC-M07",
          `Fields not in the manifest schema: ${unknown.join(
            ", "
          )}. DAPPMANAGER ignores or strips them.`,
          raw.file
        );
    }

    const composePath = path.join(dir, composeFileName);
    if (fs.existsSync(composePath)) {
      const text = fs.readFileSync(composePath, "utf8");
      const interpolated = [...new Set(text.match(/\$\{[^}]*\}/g) || [])];
      if (interpolated.length > 0)
        add(
          "SPEC-C04",
          `Uses environment interpolation ${interpolated
            .slice(0, 3)
            .join(", ")}${
            interpolated.length > 3 ? ", ..." : ""
          }; write the values out.`,
          composePath
        );
      const compose = loadYamlObject(text) as Partial<Compose> | null;
      for (const [service, def] of Object.entries(compose?.services || {}))
        if (
          def &&
          typeof def.build === "object" &&
          Array.isArray(def.build.args)
        )
          add(
            "SPEC-C05",
            `Service "${service}" lists build.args as "KEY=value" items; use a mapping (KEY: value).`,
            composePath
          );
    }
  }

  // --- Templates
  if (isTemplate) {
    if (
      rootManifest &&
      (rootManifest.manifest.name || rootManifest.manifest.version)
    )
      add(
        "SPEC-T01",
        `The root manifest sets ${["name", "version"]
          .filter(key => key in rootManifest.manifest)
          .join(
            " and "
          )} although the package has variants; set them in each variant.`,
        rootManifest.file
      );
    if (path.basename(variantsDirPath) !== defaultVariantsDirName)
      add(
        "SPEC-T02",
        `Variants are in "${path.basename(
          variantsDirPath
        )}/"; move them to ${defaultVariantsDirName}/.`,
        variantsDirPath
      );
    for (const variant of variantDirs) {
      if (!variantNamePattern.test(variant.name))
        add(
          "SPEC-T03",
          `Variant "${variant.name}" must use lowercase letters, digits and single hyphens.`,
          variant.dir
        );
      const raw = readRawManifest(variant.dir);
      if (!raw) {
        add(
          "SPEC-T05",
          `Variant "${variant.name}" has no ${manifestFileName}.`,
          variant.dir
        );
        continue;
      }
      const rootUpstream = rootManifest?.manifest.upstream;
      const variantUpstream = raw.manifest.upstream;
      if (Array.isArray(rootUpstream) && Array.isArray(variantUpstream)) {
        // A shorter or longer list is fine: the merge keeps or appends the remaining entries.
        const mismatch = variantUpstream.some(
          (item, i) => rootUpstream[i] && item?.repo !== rootUpstream[i]?.repo
        );
        if (mismatch)
          add(
            "SPEC-M06",
            `Variant upstream[] (${variantUpstream
              .map(item => item?.repo)
              .join(
                ", "
              )}) puts a different repo at a position of the root's upstream[] (${rootUpstream
              .map(item => item?.repo)
              .join(", ")}); entries are merged by position.`,
            raw.file
          );
      }
      for (const type of singleCopiedReleaseFiles) {
        const inRoot = listFiles(rootDir).find(file =>
          releaseFiles[type].regex.test(file)
        );
        const inVariant = listFiles(variant.dir).find(file =>
          releaseFiles[type].regex.test(file)
        );
        if (inRoot && inVariant)
          add(
            "SPEC-T04",
            `${type} exists in the root (${inRoot}) and in variant "${variant.name}" (${inVariant}); the variant copy replaces the root copy. Keep only one.`,
            path.join(variant.dir, inVariant)
          );
      }
    }
  }

  // --- Per built package (merged root + variant). Each finding points at the file that
  // defines the value, so a value inherited from the root is reported once, not per variant.
  for (const pkg of packagesToBuildProps) {
    const { manifest, compose } = pkg;
    const manifestDirs = pkg.manifestPaths.map(spec => spec.dir || rootDir);
    const composeDirs = pkg.composePaths.map(spec => spec.dir || rootDir);
    const where = (dir: string) =>
      dir === rootDir ? "" : ` (variant "${pkg.variant}")`;
    const manifestOrigin = (has: (m: Partial<Manifest>) => boolean) =>
      definingDir(manifestDirs, dir => readRawManifest(dir)?.manifest, has);
    const composeOrigin = (has: (c: Partial<Compose>) => boolean) =>
      definingDir(
        composeDirs,
        dir => readRawCompose(dir, composeFileName),
        has
      );
    const manifestFileIn = (dir: string) =>
      readRawManifest(dir)?.file || path.join(dir, manifestFileName);
    const composeFileIn = (dir: string) => path.join(dir, composeFileName);

    {
      const dir = manifestOrigin(m => "name" in m);
      if (!packageNamePattern.test(manifest.name || ""))
        add(
          "SPEC-M02",
          `Package name "${manifest.name}"${where(
            dir
          )} must match <name>.dnp.dappnode.eth or <name>.public.dappnode.eth.`,
          manifestFileIn(dir)
        );
    }

    // Fresh merge of the source files: the build mutates upstreamVersion on its copy.
    const sourceManifest = mergedSourceManifest(pkg) || manifest;
    const buildArgs = collectBuildArgs(compose);
    const usesUpstreamArray = Array.isArray(sourceManifest.upstream);
    const upstreams = usesUpstreamArray
      ? sourceManifest.upstream || []
      : sourceManifest.upstreamRepo
      ? [
          {
            repo: sourceManifest.upstreamRepo,
            version: sourceManifest.upstreamVersion,
            arg: sourceManifest.upstreamArg
          }
        ]
      : [];
    const upstreamDir = manifestOrigin(m =>
      usesUpstreamArray
        ? "upstream" in m
        : "upstreamRepo" in m || "upstreamArg" in m || "upstreamVersion" in m
    );
    for (const item of upstreams) {
      if (!item?.repo) continue;
      // The legacy fields default the arg to UPSTREAM_VERSION; check the version against it too.
      const upstream = { ...item, arg: item.arg || "UPSTREAM_VERSION" };
      if (!item.arg) {
        add(
          "SPEC-M04",
          buildArgs.has(upstream.arg)
            ? `Upstream ${upstream.repo}${where(
                upstreamDir
              )} relies on the implicit build arg UPSTREAM_VERSION; name it explicitly as the upstream arg.`
            : `Upstream ${upstream.repo}${where(
                upstreamDir
              )} has no arg, and no compose service declares the default build arg UPSTREAM_VERSION.`,
          manifestFileIn(upstreamDir)
        );
        if (!buildArgs.has(upstream.arg)) continue;
      }
      const values = buildArgs.get(upstream.arg);
      if (!values) {
        add(
          "SPEC-M04",
          `Upstream ${upstream.repo}${where(upstreamDir)} names arg "${
            upstream.arg
          }", which no compose service declares in build.args.`,
          manifestFileIn(upstreamDir)
        );
        continue;
      }
      // "<version>@sha256:<digest>" pins the same version by digest.
      const matchesVersion = (value: string) =>
        value === String(upstream.version) ||
        value.startsWith(`${upstream.version}@sha256:`);
      if (upstream.version !== undefined && ![...values].some(matchesVersion)) {
        const argDir = composeOrigin(c =>
          Object.values(c.services || {}).some(
            def =>
              isObject(def?.build) &&
              hasBuildArg(def.build, upstream.arg as string)
          )
        );
        const variant = where(upstreamDir) || where(argDir);
        add(
          "SPEC-M05",
          `Upstream ${upstream.repo}${variant} has version "${
            upstream.version
          }" but build arg ${upstream.arg} is "${[...values].join('", "')}".`,
          manifestFileIn(upstreamDir)
        );
      }
    }

    const services = Object.keys(compose.services || {});
    for (const exposable of manifest.exposable || [])
      if (exposable.serviceName && !services.includes(exposable.serviceName)) {
        const dir = manifestOrigin(m => "exposable" in m);
        add(
          "SPEC-M09",
          `Exposable "${exposable.name}"${where(dir)} refers to service "${
            exposable.serviceName
          }", which is not in the compose.`,
          manifestFileIn(dir)
        );
      }

    for (const [service, def] of Object.entries(compose.services || {})) {
      // Core packages keep container_name: the installer starts and addresses them by name.
      if (def.container_name && manifest.type !== "dncore") {
        const dir = composeOrigin(c =>
          Boolean(c.services?.[service]?.container_name)
        );
        add(
          "SPEC-C02",
          `Service "${service}"${where(
            dir
          )} sets container_name, which DAPPMANAGER replaces at install; remove it.`,
          composeFileIn(dir)
        );
      }
      if (!def.build && def.image && !isPinnedImage(def.image)) {
        const dir = composeOrigin(c => Boolean(c.services?.[service]?.image));
        add(
          "SPEC-C03",
          `External image "${def.image}" of service "${service}"${where(
            dir
          )} is not pinned; use an explicit version tag or digest.`,
          composeFileIn(dir)
        );
      }
    }

    if (repoSlug && manifest.repository?.url) {
      const declared = parseGithubRepoSlug(manifest.repository.url);
      if (declared.toLowerCase() !== repoSlug.toLowerCase()) {
        const dir = manifestOrigin(m => "repository" in m);
        add(
          "SPEC-M08",
          `repository.url${where(dir)} is "${
            manifest.repository.url
          }" but the package repository is ${repoSlug}.`,
          manifestFileIn(dir)
        );
      }
    }

    const label = pkg.variant ? ` (variant "${pkg.variant}")` : "";
    const composeSize = Buffer.byteLength(yaml.dump(compose));
    if (composeSize > releaseFiles.compose.maxSize)
      add(
        "SPEC-F02",
        `The release compose${label} is about ${formatSize(
          composeSize
        )}; the limit is ${formatSize(releaseFiles.compose.maxSize)}.`,
        composeFileIn(composeDirs[composeDirs.length - 1])
      );
    const manifestSize = Buffer.byteLength(JSON.stringify(manifest, null, 2));
    if (manifestSize > releaseFiles.manifest.maxSize)
      add(
        "SPEC-F02",
        `The release manifest${label} is about ${formatSize(
          manifestSize
        )}; the limit is ${formatSize(releaseFiles.manifest.maxSize)}.`,
        manifestFileIn(manifestDirs[manifestDirs.length - 1])
      );
  }

  return dedupe(findings);
}

/** GitHub "owner/repo" of the package: GITHUB_REPOSITORY in Actions, otherwise the origin remote. */
export async function getPackageRepoSlug(
  rootDir: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string | null> {
  if (env.GITHUB_REPOSITORY) return env.GITHUB_REPOSITORY;
  try {
    const remote = (
      await shell(["git", "remote", "get-url", "origin"], { cwd: rootDir })
    ).trim();
    const ssh = remote.match(/^git@github\.com:([^/]+\/[^/]+?)(\.git)?$/);
    return ssh ? ssh[1] : parseGithubRepoSlug(remote) || null;
  } catch {
    return null;
  }
}

function listVariantDirs(
  variantsDirPath: string
): { name: string; dir: string }[] {
  if (!fs.existsSync(variantsDirPath)) return [];
  return fs
    .readdirSync(variantsDirPath, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      dir: path.join(variantsDirPath, entry.name)
    }));
}

function listFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name);
  } catch {
    return [];
  }
}

function readRawManifest(
  dir: string
): { file: string; manifest: Partial<Manifest> } | null {
  const file = listFiles(dir).find(name =>
    releaseFiles.manifest.regex.test(name)
  );
  if (!file) return null;
  const manifest = loadYamlObject(
    fs.readFileSync(path.join(dir, file), "utf8")
  );
  return manifest
    ? { file: path.join(dir, file), manifest: manifest as Partial<Manifest> }
    : null;
}

/** The last directory (root first, variant last) whose file defines the value, else the root. */
function definingDir<T>(
  dirs: string[],
  read: (dir: string) => T | null | undefined,
  has: (value: T) => boolean
): string {
  for (const dir of [...dirs].reverse()) {
    const value = read(dir);
    if (value && has(value)) return dir;
  }
  return dirs[0];
}

function readRawCompose(
  dir: string,
  composeFileName: string
): Partial<Compose> | null {
  const file = path.join(dir, composeFileName);
  if (!fs.existsSync(file)) return null;
  return loadYamlObject(
    fs.readFileSync(file, "utf8")
  ) as Partial<Compose> | null;
}

function hasBuildArg(build: unknown, arg: string): boolean {
  const args = isObject(build) ? build.args : undefined;
  if (Array.isArray(args))
    return args.some(item => String(item).split("=")[0] === arg);
  return isObject(args) && arg in args;
}

/** Root and variant manifests merged the way readManifest merges them, before the build mutates them. */
function mergedSourceManifest(
  pkg: PackageToBuildProps
): Partial<Manifest> | null {
  const parts = pkg.manifestPaths.map(
    spec => readRawManifest(spec.dir || ".")?.manifest
  );
  if (parts.some(part => !part)) return null;
  return mergeByPosition(parts as Partial<Manifest>[]);
}

function mergeByPosition<T>(parts: T[]): T {
  const merge = (base: unknown, override: unknown): unknown => {
    if (Array.isArray(base) && Array.isArray(override)) {
      const out = [...base];
      override.forEach((item, i) => (out[i] = merge(base[i], item)));
      return out;
    }
    if (isObject(base) && isObject(override)) {
      const out: Record<string, unknown> = { ...base };
      for (const [key, value] of Object.entries(override))
        out[key] = merge(base[key], value);
      return out;
    }
    return override === undefined ? base : override;
  };
  return parts.reduce((acc, part) => merge(acc, part) as T, {} as T);
}

/** Build arg name -> values across all services; list-style "KEY=value" args included. */
function collectBuildArgs(compose: Compose): Map<string, Set<string>> {
  const args = new Map<string, Set<string>>();
  const put = (key: string, value: unknown) => {
    if (!args.has(key)) args.set(key, new Set());
    args
      .get(key)
      ?.add(value === undefined || value === null ? "" : String(value));
  };
  for (const def of Object.values(compose.services || {})) {
    if (!def || typeof def.build !== "object" || !def.build.args) continue;
    const buildArgs: unknown = def.build.args;
    if (Array.isArray(buildArgs))
      for (const item of buildArgs) {
        const [key, ...rest] = String(item).split("=");
        put(key, rest.join("="));
      }
    else if (isObject(buildArgs))
      for (const [key, value] of Object.entries(buildArgs)) put(key, value);
  }
  return args;
}

function isPinnedImage(image: string): boolean {
  if (image.includes("@sha256:")) return true;
  const lastSegment = image.split("/").pop() || "";
  const tag = lastSegment.includes(":")
    ? lastSegment.split(":").pop()
    : undefined;
  return Boolean(tag) && tag !== "latest";
}

let manifestSchemaFields: Set<string> | undefined;
function getManifestSchemaFields(): Set<string> {
  if (!manifestSchemaFields) {
    const require = createRequire(import.meta.url);
    const schemaPath = path.join(
      path.dirname(require.resolve("@dappnode/schemas/package.json")),
      "dist/schemas/manifest.schema.json"
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    manifestSchemaFields = new Set([
      ...Object.keys(schema.properties || {}),
      ...knownUnreleasedManifestFields
    ]);
  }
  return manifestSchemaFields;
}

function loadYamlObject(text: string): Record<string, unknown> | null {
  try {
    const value = yaml.load(text);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSize(bytes: number): string {
  return bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : `${Math.round(bytes / 1e3)} KB`;
}

function dedupe(findings: SpecFinding[]): SpecFinding[] {
  const seen = new Set<string>();
  return findings.filter(finding => {
    const key = `${finding.rule}|${finding.file || ""}|${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
