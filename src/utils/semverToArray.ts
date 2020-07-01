/**
 * Parses a semver version to the format necessary for an APM repo
 * @param semver = 0.1.8
 * @return [0, 1, 8]
 */
export function semverToArray(semver: string): string[] {
  return semver.split(".");
}
