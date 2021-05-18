import { branchNameRoot } from "../../../params";
import { Github } from "../../../providers/github/Github";
import { shell } from "../../../utils/shell";

/**
 * We only want one `bump-upstream` PR to be open since we likely
 * want to always merge to the latest version. This step lists all
 * PRs that start with the tag `branchNameRoot` and closes all but `branch`
 */
export async function closeOldPrs(
  thisRepo: Github,
  newBranch: string
): Promise<void> {
  // Get the url of the just opened PR for this branch
  const [newPr] = await thisRepo.getOpenPrsFromBranch({ branch: newBranch });
  if (newPr === undefined) {
    throw Error(`No PR found for branch ${newBranch}`);
  }

  const allBranches = await thisRepo.listBranches();

  for (const branchToDelete of allBranches) {
    const oldBranch = branchToDelete.name;
    try {
      if (
        // Only delete branches created by this bot = start with a known tag
        oldBranch.startsWith(branchNameRoot) &&
        // Keep the branch that was just created
        oldBranch != newBranch
      ) {
        const prs = await thisRepo.getOpenPrsFromBranch({ branch: oldBranch });

        for (const pr of prs) {
          try {
            // Comment the PR and close it
            await thisRepo.commentPullRequest({
              number: pr.number,
              body: `Newer version available, closing for ${newPr.html_url}`
            });
            await thisRepo.closePR(pr.number);
          } catch (e) {
            console.error(`Error commenting and closing PR ${pr.number}`, e);
          }
        }

        // Remove the old branch
        await shell(`git push origin --delete ${oldBranch}`);
      }
    } catch (e) {
      console.error(`Error deleting branch ${oldBranch}`, e);
    }
  }
}
