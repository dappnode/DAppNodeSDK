import { YargsError } from "../../params.js";
import { ReleaseType, releaseTypes } from "../../types.js";

const typesList = releaseTypes.join(" | ");

export function parseReleaseType({ type }: { type?: string }): ReleaseType {
  const tag = process.env.TRAVIS_TAG || process.env.GITHUB_REF;
  const typeFromEnv = process.env.RELEASE_TYPE;

  /**
   * Custom options to pass the type argument
   */
  if (!type) {
    if (typeFromEnv) type = typeFromEnv;

    if (tag?.includes("release")) type = parseReleaseTypeFromTag(tag);
  }

  if (!type && typeFromEnv) {
    type = typeFromEnv as ReleaseType;
  }
  if (!type && tag?.includes("release")) {
    type = parseReleaseTypeFromTag(tag);
  }

  validateReleaseType(type);

  return type as ReleaseType;
}

function parseReleaseTypeFromTag(tag: string): ReleaseType {
  return (tag.split("release/")[1] || "patch") as ReleaseType;
}

/**
 * Make sure the release type exists and is correct
 */
function validateReleaseType(type?: string) {
  if (!type)
    throw new YargsError(`Missing required argument [type]: ${typesList}`);

  if (!releaseTypes.includes(type as ReleaseType))
    throw new YargsError(
      `Invalid release type "${type}", must be: ${typesList}`
    );
}
