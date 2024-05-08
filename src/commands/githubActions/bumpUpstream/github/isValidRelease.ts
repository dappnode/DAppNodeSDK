import semver from "semver";

export function isValidRelease(version: string): boolean {
  // Nightly builds are not considered valid releases (not taken into account by semver)
  if (version.includes("nightly")) return false;

  if (!semver.valid(version)) return false;

  const preReleases = semver.prerelease(version);

  // A version is considered a valid release if it has no pre-release components.
  return preReleases === null || preReleases.length === 0;
}
