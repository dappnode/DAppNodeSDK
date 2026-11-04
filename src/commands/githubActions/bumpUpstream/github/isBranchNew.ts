import { Github } from "../../../../providers/github/Github.js";
import { getLocalBranchExists } from "../../../../utils/git.js";

export async function isBranchNew({
  branchName,
  repo,
  dir
}: {
  branchName: string;
  repo: Github;
  dir?: string;
}): Promise<boolean> {
  const [remoteBranchExists, localBranchExists] = await Promise.all([
    repo.branchExists(branchName),
    getLocalBranchExists(branchName, dir)
  ]);

  return !remoteBranchExists && !localBranchExists;
}
