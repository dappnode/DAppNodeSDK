import semver from "semver";

export function isValidRelease(version: string): boolean {
  // Commands receive tags as arguments, not shell source; this only rejects
  // characters that can never form a branch name. `@` is used by real
  // upstreams (e.g. n8n@2.46.6).
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._+/@-]*$/.test(version)) return false;
  // Nightly builds are not considered valid releases (not taken into account by semver)
  if (version.toLowerCase().includes("nightly")) return false;

  if (semver.valid(version)) {
    const preReleases = semver.prerelease(version);

    // A version is considered a valid release if it has no pre-release components.
    return preReleases === null || preReleases.length === 0;
  }

  console.warn(
    `Upstream version (${version}) does not follow semver. This might be a release candidate or pre-release.`
  );

  return true;
}
