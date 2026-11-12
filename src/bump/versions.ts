import semver from "semver";

export function versionCandidates(tag: string): string[] {
  const bare = /^\d/.test(tag)
    ? undefined
    : tag.match(/\d+\.\d+\.\d+(?:[-+].*)?/)?.[0];
  return bare && bare !== tag ? [tag, bare] : [tag];
}

export function comparableVersion(value: string): string | null {
  return (
    versionCandidates(value)
      .map(candidate => semver.valid(candidate))
      .find(Boolean) ?? null
  );
}

export function isOlderVersion(latest: string, current: string): boolean {
  const a = comparableVersion(latest);
  const b = comparableVersion(current);
  return Boolean(a && b && semver.lt(a, b));
}

export function highestSemverTag(tags: string[]): string | null {
  const valid = tags.filter(
    tag => /^v?\d+\.\d+\.\d+(?:[-+].*)?$/.test(tag) && semver.valid(tag)
  );
  const stable = valid.filter(tag => semver.prerelease(tag) === null);
  return (
    (stable.length ? stable : valid).sort(
      (a, b) =>
        semver.rcompare(a, b) ||
        Number(a.startsWith("v")) - Number(b.startsWith("v"))
    )[0] ?? null
  );
}
