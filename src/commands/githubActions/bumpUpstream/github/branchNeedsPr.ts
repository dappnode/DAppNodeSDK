/** The two Github methods this needs. */
interface BranchPrSource {
  branchExists(branch: string): Promise<boolean>;
  getPrsFromBranch(branch: string): Promise<unknown[]>;
}

/**
 * True when a bump branch was pushed but never got a PR, open or closed, for
 * example because the token was not allowed to create pull requests. Such a
 * branch would otherwise make every later run skip that release. A branch whose
 * PR was closed stays skipped: closing it was a decision.
 */
export async function branchNeedsPr({
  repo,
  branchName
}: {
  repo: BranchPrSource;
  branchName: string;
}): Promise<boolean> {
  if (!(await repo.branchExists(branchName))) return false;
  const prs = await repo.getPrsFromBranch(branchName);
  return prs.length === 0;
}
