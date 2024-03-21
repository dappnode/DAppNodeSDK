import { ComposeVersionsToUpdate } from "../types";

export function getBumpPrBody(versionsToUpdate: ComposeVersionsToUpdate): string {
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