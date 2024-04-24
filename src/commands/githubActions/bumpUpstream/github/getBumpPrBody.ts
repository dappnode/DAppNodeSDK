import { UpstreamSettings } from "../types.js";

export function getBumpPrBody(upstreamSettings: UpstreamSettings[]): string {
    return [
        "Bumps upstream version",
        upstreamSettings.flatMap(({ repo, githubVersion, manifestVersion }) =>
            `- [${repo}](${getGitHubUrl({ repo })}) from ${manifestVersion} to [${githubVersion}](${getGitHubUrl({ repo, tag: githubVersion })})`
        ).join("\n")
    ].join("\n\n");
}

function getGitHubUrl({ repo, tag = "" }: { repo: string, tag?: string }): string {
    const baseUrl = `https://github.com/${repo}`;
    return tag ? `${baseUrl}/releases/tag/${tag}` : baseUrl;
}