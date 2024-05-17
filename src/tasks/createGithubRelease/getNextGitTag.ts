import { ReleaseDetailsMap } from "./types.js";

/**
 * Returns the next git tag based on the next version defined in the context
 *
 * - If the package is a multi-variant package, the tag will be in the format:
 *  `gnosis@v0.1.2_holesky@v1.2.3_mainnet@v3.21.1` sorted alphabetically by variant
 *
 * - If the package is a single-variant package, the tag will be in the format:
 *  `v0.1.2`
 */
export function getNextGitTag(releaseDetailsMap: ReleaseDetailsMap): string {
  const variantVersions = Object.entries(
    releaseDetailsMap
  ).map(([, { variant, nextVersion }]) => ({ variant, nextVersion }));

  if (variantVersions.length === 0)
    throw Error("Could not generate git tag. Missing variant or nextVersion");

  // Not a multi-variant package
  if (variantVersions.length === 1) {
    const version = variantVersions[0].nextVersion;

    if (!version)
      throw Error("Could not generate git tag. Missing nextVersion");

    return `v${variantVersions[0].nextVersion}`;
  }

  // Multi-variant package
  return variantVersions
    .sort((a, b) => {
      if (typeof a.variant !== "string" || typeof b.variant !== "string") {
        // TODO: Filter out undefined variants
        throw new Error(
          "Could not generate git tag: Variant name cannot be undefined"
        );
      }
      return a.variant.localeCompare(b.variant);
    }) // Sort alphabetically by variant
    .map(({ variant, nextVersion }) => `${variant}@${nextVersion}`) // Map to string
    .join("_"); // Join into a single string
}
