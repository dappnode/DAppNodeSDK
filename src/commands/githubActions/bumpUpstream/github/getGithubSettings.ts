import { branchNameRoot } from "../../../../params.js";
import { Github } from "../../../../providers/github/Github.js";
import { GithubSettings, GitBranch, UpstreamSettings } from "../types.js";

export async function getGithubSettings(dir: string, upstreamSettings: UpstreamSettings[]): Promise<GithubSettings> {
    const thisRepo = Github.fromLocal(dir);
    const repoData = await thisRepo.getRepo();
    const branch = getBumpBranch(upstreamSettings);
    return { repo: thisRepo, repoData, ...branch };
}

function getBumpBranch(upstreamSettings: UpstreamSettings[]): GitBranch {
    const branchName = branchNameRoot +
        Array.from(Object.values(upstreamSettings))
            .map(({ repo, githubVersion }) => `${repo}@${githubVersion}`)
            .join(",");
    const branchRef = `refs/heads/${branchName}`;

    return { branchName, branchRef };
}