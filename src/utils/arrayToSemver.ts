/**
 * Parses a semver version array from the APM format to its regular string format to the format
 * @param versionArray = [0, 1, 8]
 * @return 0.1.8
 */
export function arrayToSemver(versionArray: string[]): string {
  return versionArray.join(".");
}
