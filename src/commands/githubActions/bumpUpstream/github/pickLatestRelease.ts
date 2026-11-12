import { isValidRelease, releaseTagPattern } from "./isValidRelease.js";
import { extractVersion } from "../../../../bump/metadata.js";

interface Release {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Returns the version of the first qualifying release, or null when there is
 * none. A release qualifies when it is not a draft, not flagged as a
 * pre-release, matches `tagPattern` and passes isValidRelease. The version is
 * capture group 1 of `tagPattern` (or the whole match), else the tag.
 * `releases` comes newest first, as GitHub lists them. A release candidate
 * published after a stable release must not hide that stable release.
 */
export function pickLatestRelease(
  releases: Release[],
  tagPattern?: string
): string | null {
  for (const { tag_name, draft, prerelease } of releases) {
    if (draft || prerelease || tag_name.toLowerCase().includes("nightly"))
      continue;
    const version = extractVersion(tag_name, tagPattern);
    if (
      !version ||
      !releaseTagPattern.test(tag_name) ||
      !isValidRelease(version)
    )
      continue;
    return version;
  }
  return null;
}

/**
 * GitHub's Latest release when it qualifies, else the first qualifying recent
 * release. Latest respects the maintainer's choice, e.g. upstreams that
 * publish backports after a newer release line.
 */
export async function selectLatestRelease(
  latest: Release | null,
  recentReleases: () => Promise<Release[]>,
  tagPattern?: string
): Promise<string | null> {
  const fromLatest = latest && pickLatestRelease([latest], tagPattern);
  return fromLatest || pickLatestRelease(await recentReleases(), tagPattern);
}
