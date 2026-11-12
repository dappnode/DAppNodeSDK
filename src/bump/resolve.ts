import { BumpCompose, getBuildArgs, Upstream } from "./discovery.js";
import { findImageSource, ImageSource, renderDockerTag } from "./dockerfile.js";
import { extractVersion } from "./metadata.js";
import { digestPattern, RegistryClient } from "./registry.js";
import { isOlderVersion, versionCandidates } from "./versions.js";

/** A compose build arg value: a version, optionally pinned by digest. */
export interface Pin {
  version: string;
  digest?: string;
}

export interface ResolvedUpstream extends Upstream {
  /** Version to write to the manifest; `version` when already current. */
  targetVersion: string;
  /** Value to write to the compose build arg, keeping a digest pin. */
  composeValue: string;
}

export interface ResolutionDependencies {
  latestRelease: (repo: string, tagPattern?: string) => Promise<string | null>;
  registry: Pick<RegistryClient, "tagExists" | "manifestDigest" | "latestTag">;
  imageSource?: (
    dir: string,
    compose: BumpCompose,
    arg: string
  ) => ImageSource | null;
}

interface ResolutionContext {
  upstream: Upstream;
  dependencies: ResolutionDependencies;
  explicitVersion?: string;
  /** Reads the Dockerfile image lazily: most bumps never need it. */
  getImageSource: () => ImageSource | null;
}

/**
 * Splits a build arg value into its version and its `@sha256:<digest>` pin.
 */
export function parsePin(value: string): Pin {
  const separator = value.lastIndexOf("@");
  if (separator < 0 || !value.slice(separator + 1).startsWith("sha256:"))
    return { version: value };

  const version = value.slice(0, separator);
  const digest = value.slice(separator + 1);
  if (!version || !digestPattern.test(digest))
    throw Error(
      `Invalid digest pin: ${value}; expected 64 lowercase hex characters`
    );

  return { version, digest };
}

/**
 * Returns the pin of the upstream arg. Every service declaring the arg must use
 * the manifest version and the same digest.
 */
export function getCurrentPin(compose: BumpCompose, upstream: Upstream): Pin {
  const values = Object.entries(compose.services).flatMap(
    ([service, definition]) =>
      getBuildArgs(definition)
        .filter(([name]) => name === upstream.arg)
        .map(([, value]) => ({ service, value }))
  );
  if (values.length === 0)
    throw Error(`Required Compose build argument '${upstream.arg}' is absent`);

  const pins = values.map(({ service, value }) => {
    if (typeof value !== "string" && typeof value !== "number")
      throw Error(`Inherited or invalid arg ${upstream.arg} in ${service}`);

    const pin = parsePin(String(value));
    if (pin.version !== upstream.version)
      throw Error(
        `Inconsistent Compose pin for ${upstream.arg} in ${service}: ${value}; manifest has ${upstream.version}`
      );
    return pin;
  });

  if (pins.some(pin => pin.digest !== pins[0].digest))
    throw Error(`Inconsistent digest pins across services for ${upstream.arg}`);

  return pins[0];
}

/**
 * Resolves the version to bump an upstream to, and the compose value for it.
 * A resolved release older than the current version is ignored unless it was
 * requested explicitly. Returns null when there is no qualifying release.
 */
export async function resolveUpstream(
  dir: string,
  compose: BumpCompose,
  upstream: Upstream,
  dependencies: ResolutionDependencies,
  explicitVersion?: string
): Promise<ResolvedUpstream | null> {
  const pin = getCurrentPin(compose, upstream);
  const context: ResolutionContext = {
    upstream,
    dependencies,
    explicitVersion,
    getImageSource: () =>
      (dependencies.imageSource || findImageSource)(dir, compose, upstream.arg)
  };

  const tag = await getTargetTag(context);
  if (tag === null) return null;

  const current: ResolvedUpstream = {
    ...upstream,
    targetVersion: upstream.version,
    composeValue: pin.digest
      ? `${upstream.version}@${pin.digest}`
      : upstream.version
  };
  if (versionCandidates(tag).includes(upstream.version)) return current;
  if (isUnwantedDowngrade(context, tag)) return current;

  const targetVersion = await getImageTagVersion(context, tag);
  if (targetVersion === upstream.version) return current;
  if (isUnwantedDowngrade(context, targetVersion)) return current;

  const composeValue = pin.digest
    ? `${targetVersion}@${await getImageDigest(context, targetVersion)}`
    : targetVersion;

  return { ...upstream, targetVersion, composeValue };
}

/**
 * The tag to bump to: the explicit version, the highest image tag for the
 * `docker_tags` provider, or the latest GitHub release otherwise.
 */
async function getTargetTag(
  context: ResolutionContext
): Promise<string | null> {
  const { upstream, dependencies, explicitVersion } = context;

  if (explicitVersion !== undefined)
    return (
      extractVersion(explicitVersion, upstream.tagPattern) ?? explicitVersion
    );

  if (upstream.provider !== "docker_tags")
    return dependencies.latestRelease(upstream.repo, upstream.tagPattern);

  const imageSource = context.getImageSource();
  if (!imageSource) throw Error(`No FROM image uses ${upstream.arg}`);

  const latestTag = await dependencies.registry.latestTag(imageSource.image);
  if (latestTag === null) return null;

  const version = extractVersion(latestTag, upstream.tagPattern);
  if (version === null)
    throw Error(`Latest image tag '${latestTag}' does not match tagPattern`);
  return version;
}

/**
 * For the `docker` provider, returns the form of `tag` (the tag itself or its
 * bare version) that the package image is published under. An explicit
 * `docker_tags` version is checked too, since it does not come from the tag
 * list. Packages whose arg is not used in a `FROM` image keep the tag.
 */
async function getImageTagVersion(
  context: ResolutionContext,
  tag: string
): Promise<string> {
  const { upstream, dependencies, explicitVersion } = context;
  const checksImageTag =
    upstream.provider === "docker" ||
    (upstream.provider === "docker_tags" && explicitVersion !== undefined);
  if (!checksImageTag) return tag;

  const imageSource = context.getImageSource();
  if (!imageSource) return tag;

  for (const version of versionCandidates(tag)) {
    const imageTag = renderDockerTag(imageSource, version);
    if (await dependencies.registry.tagExists(imageSource.image, imageTag))
      return version;
  }

  throw Error(
    `No Docker tag candidate exists on ${imageSource.image} for ${tag}`
  );
}

async function getImageDigest(
  context: ResolutionContext,
  version: string
): Promise<string> {
  const imageSource = context.getImageSource();
  if (!imageSource)
    throw Error(`Pinned argument ${context.upstream.arg} needs a FROM image`);

  return context.dependencies.registry.manifestDigest(
    imageSource.image,
    renderDockerTag(imageSource, version)
  );
}

/**
 * Some upstreams publish images ahead of GitHub releases, so the latest
 * release can be older than the packaged version. Only an explicit request
 * may go back.
 */
function isUnwantedDowngrade(
  context: ResolutionContext,
  version: string
): boolean {
  return (
    context.explicitVersion === undefined &&
    isOlderVersion(version, context.upstream.version)
  );
}
