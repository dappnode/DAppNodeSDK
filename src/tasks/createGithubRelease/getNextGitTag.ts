import { ReleaseDetailsMap } from "./types.js";

// Only variant and nextVersion are needed from the ReleaseDetailsMap
type GitTagDetailsMap = {
  [K in keyof ReleaseDetailsMap]: Pick<
    ReleaseDetailsMap[K],
    "variant" | "nextVersion"
  >;
};

/**
 * Returns the next git tag based on the next version defined in the context
 *
 * - If the package is a multi-variant package, the tag will be in the format:
 *  `gnosis@v0.1.2_holesky@v1.2.3_mainnet@v3.21.1` sorted alphabetically by variant
 *
 * - If the package is a single-variant package, the tag will be in the format:
 *  `v0.1.2`
 */
export function getNextGitTag(releaseDetailsMap: GitTagDetailsMap): string {
  const variantVersions = Object.entries(
    releaseDetailsMap
  ).map(([, { variant, nextVersion }]) => ({ variant, nextVersion }));

  if (variantVersions.length === 0)
    throw Error("Could not generate git tag. Missing variant or nextVersion");

  // Not a multi-variant package
  if (variantVersions.length === 1) return `v${variantVersions[0].nextVersion}`;

  // Multi-variant package
  return variantVersions
    .sort((a, b) => a.variant.localeCompare(b.variant)) // Sort alphabetically by variant
    .map(({ variant, nextVersion }) => `${variant}@${nextVersion}`) // Map to string
    .join("_"); // Join into a single string
}
