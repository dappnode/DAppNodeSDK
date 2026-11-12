import { UpstreamItem } from "@dappnode/types";

/**
 * Manifest upstream entry with the optional bump metadata. Drop it for
 * `UpstreamItem` once the published @dappnode/types includes these fields.
 */
export type BumpUpstreamItem = UpstreamItem & {
  provider?: string;
  tagPattern?: string;
};

export type UpstreamProvider = "docker" | "github" | "docker_tags";

const providersByName = new Map<string, UpstreamProvider>([
  ["docker", "docker"],
  ["github", "github"],
  ["docker_tags", "docker_tags"],
  ["docker-tags", "docker_tags"],
  ["dockerhub", "docker_tags"]
]);

/**
 * Parses the upstream `provider` field, case-insensitively. An unset or empty
 * provider means `docker`.
 */
export function parseProvider(provider: unknown): UpstreamProvider {
  if (provider === undefined) return "docker";
  if (typeof provider !== "string")
    throw Error(`Unknown upstream provider: ${String(provider)}`);

  const name = provider.trim().toLowerCase();
  if (name === "") return "docker";

  const parsed = providersByName.get(name);
  if (!parsed) throw Error(`Unknown upstream provider: ${provider}`);
  return parsed;
}

/**
 * Compiles the upstream `tagPattern`. The org bump engine evaluates the same
 * pattern with Rust's `regex`, which has no lookaround or backreferences, so
 * those are rejected here as well.
 */
export function compileTagPattern(tagPattern: unknown): RegExp | undefined {
  if (tagPattern === undefined) return undefined;
  if (typeof tagPattern !== "string")
    throw Error("tagPattern must be a string");

  // Drop escaped backslashes so `\\1` is not mistaken for a backreference
  const pattern = tagPattern.replace(/\\\\/g, "");
  if (/\(\?<?[=!]/.test(pattern))
    throw Error("tagPattern must not use lookaround");
  if (/\\[1-9]|\\k</.test(pattern))
    throw Error("tagPattern must not use backreferences");

  return new RegExp(tagPattern);
}

/**
 * Returns the version in a release tag: capture group 1 of `tagPattern`, or the
 * whole match when the pattern has no group. Without a pattern the tag is the
 * version. Returns null when the tag does not match.
 */
export function extractVersion(
  tag: string,
  tagPattern?: string
): string | null {
  const regex = compileTagPattern(tagPattern);
  if (!regex) return tag;

  const match = regex.exec(tag);
  if (!match) return null;
  return match[1] ?? match[0];
}
