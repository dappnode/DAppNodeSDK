import { BumpCompose, buildArgs, Upstream } from "./discovery.js";
import { findImageSource, ImageSource, renderDockerTag } from "./dockerfile.js";
import { extractVersion } from "./metadata.js";
import { digestPattern, RegistryClient } from "./registry.js";
import { isOlderVersion, versionCandidates } from "./versions.js";

export function splitPin(value: string): { version: string; digest?: string } {
  const at = value.lastIndexOf("@");
  if (at < 0 || !value.slice(at + 1).startsWith("sha256:"))
    return { version: value };
  const version = value.slice(0, at);
  const digest = value.slice(at + 1);
  if (!version || !digestPattern.test(digest))
    throw Error(
      `Invalid digest pin: ${value}; expected 64 lowercase hex characters`
    );
  return { version, digest };
}

export function currentPin(
  compose: BumpCompose,
  upstream: Upstream
): { version: string; digest?: string } {
  const entries = Object.entries(compose.services).flatMap(([service, value]) =>
    buildArgs(value)
      .filter(([key]) => key === upstream.arg)
      .map(([, value]) => ({ service, value }))
  );
  if (!entries.length)
    throw Error(`Required Compose build argument '${upstream.arg}' is absent`);
  const pins = entries.map(({ service, value }) => {
    if (typeof value !== "string" && typeof value !== "number")
      throw Error(`Inherited or invalid arg ${upstream.arg} in ${service}`);
    const pin = splitPin(String(value));
    if (pin.version !== upstream.version)
      throw Error(
        `Inconsistent Compose pin for ${upstream.arg} in ${service}: ${String(
          value
        )}; manifest has ${upstream.version}`
      );
    return pin;
  });
  if (pins.some(pin => pin.digest !== pins[0].digest))
    throw Error(`Inconsistent digest pins across services for ${upstream.arg}`);
  return pins[0];
}

export interface ResolvedUpstream extends Upstream {
  targetVersion: string;
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

export async function resolveUpstream(
  dir: string,
  compose: BumpCompose,
  upstream: Upstream,
  dependencies: ResolutionDependencies,
  explicitVersion?: string
): Promise<ResolvedUpstream | null> {
  const pin = currentPin(compose, upstream);
  let source: ImageSource | null | undefined;
  const image = () =>
    source === undefined
      ? (source = (dependencies.imageSource || findImageSource)(
          dir,
          compose,
          upstream.arg
        ))
      : source;
  let tag: string | null;
  if (explicitVersion !== undefined)
    tag =
      extractVersion(explicitVersion, upstream.tagPattern) ?? explicitVersion;
  else if (upstream.provider === "docker_tags") {
    const found = image();
    if (!found) throw Error(`No FROM image uses ${upstream.arg}`);
    const chosen = await dependencies.registry.latestTag(found.image);
    tag = chosen === null ? null : extractVersion(chosen, upstream.tagPattern);
    if (chosen !== null && tag === null)
      throw Error(`Latest image tag '${chosen}' does not match tagPattern`);
  } else
    tag = await dependencies.latestRelease(upstream.repo, upstream.tagPattern);
  if (tag === null) return null;
  const unchanged = (): ResolvedUpstream => ({
    ...upstream,
    targetVersion: upstream.version,
    composeValue: upstream.version + (pin.digest ? `@${pin.digest}` : "")
  });
  if (versionCandidates(tag).includes(upstream.version)) return unchanged();
  if (explicitVersion === undefined && isOlderVersion(tag, upstream.version))
    return unchanged();
  let targetVersion = tag;
  if (
    upstream.provider === "docker" ||
    (upstream.provider === "docker_tags" && explicitVersion !== undefined)
  ) {
    const found = image();
    if (found) {
      let candidate: string | undefined;
      for (const version of versionCandidates(tag)) {
        if (
          await dependencies.registry.tagExists(
            found.image,
            renderDockerTag(found, version)
          )
        ) {
          candidate = version;
          break;
        }
      }
      if (!candidate)
        throw Error(
          `No Docker tag candidate exists on ${found.image} for ${tag}`
        );
      targetVersion = candidate;
    }
  }
  if (
    targetVersion === upstream.version ||
    (explicitVersion === undefined &&
      isOlderVersion(targetVersion, upstream.version))
  )
    return unchanged();
  let composeValue = targetVersion;
  if (pin.digest) {
    const found = image();
    if (!found)
      throw Error(`Pinned argument ${upstream.arg} needs a FROM image`);
    const digest = await dependencies.registry.manifestDigest(
      found.image,
      renderDockerTag(found, targetVersion)
    );
    composeValue += `@${digest}`;
  }
  return { ...upstream, targetVersion, composeValue };
}
