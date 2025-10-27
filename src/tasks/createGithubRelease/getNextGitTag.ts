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
 *
 * - If isMultiVariant is true, always use variant@v<version> format, even for a single variant
 */
export function getNextGitTag(releaseDetailsMap: GitTagDetailsMap, isMultiVariant: boolean): string {
  const variantVersions = Object.entries(
    releaseDetailsMap
  ).map(([, { variant, nextVersion }]) => ({ variant, nextVersion }));

  if (variantVersions.length === 0)
    throw Error("Could not generate git tag. Missing variant or nextVersion");

  // If not multi-variant and only one variant, return v<version>
  if (variantVersions.length === 1 && !isMultiVariant)
    return `v${variantVersions[0].nextVersion}`;

  // If any variant is null, throw an error
  if (variantVersions.some(({ variant }) => !variant))
    throw Error("Could not generate git tag. Missing variant");

  // If isMultiVariant, always use variant@v<version> format, even for a single variant
  if (isMultiVariant) {
    return variantVersions
      .sort((a, b) => (a.variant || "").localeCompare(b.variant || ""))
      .map(({ variant, nextVersion }) => `${variant}@v${nextVersion}`)
      .join("_");
  }

  // Multi-variant package (fallback, should not hit if isMultiVariant is set correctly)
  return variantVersions
    .sort((a, b) => (a.variant || "").localeCompare(b.variant || ""))
    .map(({ variant, nextVersion }) => `${variant}@v${nextVersion}`)
    .join("_");
}
