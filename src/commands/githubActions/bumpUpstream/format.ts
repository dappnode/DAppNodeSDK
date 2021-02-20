export interface VersionToUpdate {
  repoSlug: string;
  newVersion: string;
  currentVersion: string;
}

export function getPrBody(versionsToUpdate: VersionToUpdate[]): string {
  return [
    "Bumps upstream version",
    versionsToUpdate
      .map(
        ({ repoSlug, newVersion, currentVersion }) =>
          `- [${repoSlug}](https://github.com/${repoSlug}) from ${currentVersion} to [${newVersion}](https://github.com/${repoSlug}/releases/tag/${newVersion})`
      )
      .join("\n")
  ].join("\n\n");
}

// https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0

export function getUpstreamVersionTag(
  versionsToUpdate: VersionToUpdate[]
): string {
  return versionsToUpdate.length === 1
    ? versionsToUpdate[0].newVersion
    : versionsToUpdate
        .map(({ repoSlug, newVersion }) => `${repoSlug}@${newVersion}`)
        .join(", ");
}
