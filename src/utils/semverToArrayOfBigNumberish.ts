import { BigNumberish } from "ethers";

/**
 * Parses a semver version to the format necessary for an APM repo
 * @param semver = 0.1.8
 * @return [0, 1, 8]
 */
export function semverToArrayOfBigNumberish(
  semver: string
): [BigNumberish, BigNumberish, BigNumberish] {
  const [major, minor, patch] = semver.split(".").map(Number);
  return [major, minor, patch];
}
