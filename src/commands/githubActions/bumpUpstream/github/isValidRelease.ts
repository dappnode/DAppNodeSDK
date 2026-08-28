import semver from "semver";
import type { components } from "@octokit/openapi-types";

export function isValidRelease(version: components["schemas"]["release"]): boolean {
  const tagName = version.tag_name;
  // Nightly builds are not considered valid releases (not taken into account by semver)
  if (tagName.includes("nightly")) return false;

  if (semver.valid(tagName)) {
    const preReleases = semver.prerelease(tagName);

    // A version is considered a valid release if it has no pre-release components.
    return preReleases === null || preReleases.length === 0;
  }

  console.warn(
    `Upstream version (${version}) does not follow semver. This might be a release candidate or pre-release.`
  );

  return true;
}
