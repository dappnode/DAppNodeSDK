import semver from "semver";

export type VersionsToUpdate = {
  [repoSlug: string]: {
    newVersion: string;
    currentVersion: string;
  };
};

export function getPrBody(versionsToUpdate: VersionsToUpdate): string {
  return [
    "Bumps upstream version",
    Object.entries(versionsToUpdate)
      .map(([repoSlug, { newVersion, currentVersion }]) =>
        `- [${repoSlug}](${getGitHubUrl({ repoSlug })}) from ${currentVersion} to [${newVersion}](${getGitHubUrl({ repoSlug, tag: newVersion })})`
      )
      .join("\n")
  ].join("\n\n");
}

function getGitHubUrl({ repoSlug, tag = "" }: { repoSlug: string, tag?: string }): string {
  const baseUrl = `https://github.com/${repoSlug}`;
  return tag ? `${baseUrl}/releases/tag/${tag}` : baseUrl;
}

// https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0
export function getUpstreamVersionTag(versionsToUpdate: VersionsToUpdate): string {
  const entries = Object.entries(versionsToUpdate);

  if (entries.length === 1) {
    const [{ newVersion }] = Object.values(versionsToUpdate);
    return newVersion;
  } else {
    return entries
      .map(([repoSlug, { newVersion }]) => `${repoSlug}@${newVersion}`)
      .join(", ");
  }
}

//Checking if the proposed release is nightly or realeaseCandidate
export function isUndesiredRelease(version: string): boolean {
  return !(semver.valid(version) && !semver.prerelease(version));
}
