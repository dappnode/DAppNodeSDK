import semver from "semver";

export function isValidRelease(version: string): boolean {
  // Nightly builds are not considered valid releases (not taken into account by semver)
  if (version.includes("nightly")) return false;

  // Strip any prefix (e.g. "v1.2.3" -> "1.2.3", "n8n@2.10.3" -> "2.10.3")
  const cleaned = stripTagPrefix(version) || version;

  if (semver.valid(cleaned)) {
    const preReleases = semver.prerelease(cleaned);

    // A version is considered a valid release if it has no pre-release components.
    return preReleases === null || preReleases.length === 0;
  }

  console.warn(
    `Upstream version (${version}) does not follow semver. This might be a release candidate or pre-release.`
  );

  return true;
}

function stripTagPrefix(tag: string): string | null {
  const match = tag.match(/(\d+\.\d+\.\d+.*)$/);
  return match ? match[1] : null;
}
