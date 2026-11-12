import semver from "semver";
import { versionCandidates } from "../../../../bump/versions.js";

export const releaseTagPattern = /^[a-zA-Z0-9][a-zA-Z0-9._+/@-]*$/;

/**
 * Semver pre-release parts starting with one of these words mark a pre-release.
 * Other suffixes are stable flavours, e.g. gnosischain/go-ethereum `v1.17.10-gc`.
 */
const prereleaseWords = [
  "alpha",
  "beta",
  "rc",
  "pre",
  "preview",
  "dev",
  "canary",
  "nightly",
  "snapshot",
  "unstable"
];

export function isValidRelease(version: string): boolean {
  // Commands receive tags as arguments, not shell source; this only rejects
  // characters that can never form a branch name. `@` is used by real
  // upstreams (e.g. n8n@2.46.6).
  if (!releaseTagPattern.test(version)) return false;
  // Nightly builds are not considered valid releases (not taken into account by semver)
  if (version.toLowerCase().includes("nightly")) return false;

  // Strip a non-numeric prefix such as `v` or `n8n@` before parsing.
  const core = semver.valid(versionCandidates(version).at(-1)!);
  if (core) {
    const pre = (semver.prerelease(core) || []).join(".").toLowerCase();
    return !prereleaseWords.some(word => pre.startsWith(word));
  }

  console.warn(
    `Upstream version (${version}) does not follow semver. This might be a release candidate or pre-release.`
  );

  return true;
}
