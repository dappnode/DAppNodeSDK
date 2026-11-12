import semver from "semver";

/**
 * Returns the version strings to try for a release tag: the tag itself, then
 * its bare semver when the tag has a prefix, e.g. `v1.2.3` or `n8n@1.2.3`
 * also try `1.2.3`.
 */
export function versionCandidates(tag: string): string[] {
  if (/^\d/.test(tag)) return [tag];

  const bareVersion = tag.match(/\d+\.\d+\.\d+(?:[-+].*)?/)?.[0];
  if (!bareVersion) return [tag];
  return [tag, bareVersion];
}

/**
 * Returns the semver form of a version or tag, or null when it has none.
 */
export function comparableVersion(version: string): string | null {
  for (const candidate of versionCandidates(version)) {
    const valid = semver.valid(candidate);
    if (valid) return valid;
  }
  return null;
}

/**
 * True when both versions are semver and `latest` is older than `current`.
 */
export function isOlderVersion(latest: string, current: string): boolean {
  const latestSemver = comparableVersion(latest);
  const currentSemver = comparableVersion(current);
  if (!latestSemver || !currentSemver) return false;
  return semver.lt(latestSemver, currentSemver);
}

/**
 * Returns the highest `MAJOR.MINOR.PATCH` tag, allowing a leading `v` and a
 * pre-release or build suffix. Stable tags win over pre-releases, which are
 * only used when there is no stable tag. On equal versions the tag without `v`
 * wins.
 */
export function highestSemverTag(tags: string[]): string | null {
  const semverTags = tags.filter(
    tag => /^v?\d+\.\d+\.\d+(?:[-+].*)?$/.test(tag) && semver.valid(tag)
  );
  const stableTags = semverTags.filter(tag => semver.prerelease(tag) === null);
  const candidates = stableTags.length > 0 ? stableTags : semverTags;

  const [highest] = [...candidates].sort(compareTagsDescending);
  return highest ?? null;
}

function compareTagsDescending(a: string, b: string): number {
  const byVersion = semver.rcompare(a, b);
  if (byVersion !== 0) return byVersion;
  return Number(a.startsWith("v")) - Number(b.startsWith("v"));
}
