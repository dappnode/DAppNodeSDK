import { branchNameRoot } from "../../../../params.js";
import { Github } from "../../../../providers/github/Github.js";
import { UpstreamRepoMap, GithubSettings, GitBranch } from "../types.js";

export async function getGithubSettings(dir: string, upstreamVersions: UpstreamRepoMap): Promise<GithubSettings> {
    const thisRepo = Github.fromLocal(dir);
    const repoData = await thisRepo.getRepo();
    const branch = getBumpBranch(upstreamVersions);
    return { repo: thisRepo, repoData, ...branch };
}

function getBumpBranch(upstreamVersions: UpstreamRepoMap): GitBranch {
    const branchName = branchNameRoot +
        Array.from(Object.values(upstreamVersions))
            .map(({ repo, newVersion }) => `${repo}@${newVersion}`)
            .join(",");
    const branchRef = `refs/heads/${branchName}`;

    return { branchName, branchRef };
}