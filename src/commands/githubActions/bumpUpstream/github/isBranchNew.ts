import { Github } from "../../../../providers/github/Github.js";
import { getLocalBranchExists } from "../../../../utils/git.js";

export async function isBranchNew({ branchName, repo }: { branchName: string, repo: Github }): Promise<boolean> {
    const [remoteBranchExists, localBranchExists] = await Promise.all([
        repo.branchExists(branchName),
        getLocalBranchExists(branchName),
    ]);

    return !remoteBranchExists && !localBranchExists;
}