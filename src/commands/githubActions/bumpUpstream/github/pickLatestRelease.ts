import { isValidRelease } from "./isValidRelease.js";

interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Returns the tag of the newest release that is not a draft, not flagged as a
 * pre-release and passes isValidRelease, or null when there is none.
 * `releases` comes newest first, as GitHub lists them. A release candidate
 * published after a stable release must not hide that stable release.
 */
export function pickLatestRelease(releases: Release[]): string | null {
  for (const { tag_name, draft, prerelease } of releases) {
    if (draft || prerelease || !isValidRelease(tag_name)) continue;
    return tag_name;
  }
  return null;
}
