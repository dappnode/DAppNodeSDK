import { branchNameRoot } from "../../../../params.js";
import { Github } from "../../../../providers/github/Github.js";
import { shell } from "../../../../utils/shell.js";

/**
 * Close old PRs related to bump-upstream branches, keeping only the latest one.
 */
export async function closeOldPrs(
  thisRepo: Github,
  newBranch: string
): Promise<void> {
  const newPr = await getNewPr(thisRepo, newBranch);
  const bumpBranches = await getBumpBranches(thisRepo, newBranch);

  for (const oldBranch of bumpBranches) {
    await closePrsAndDeleteBranch(thisRepo, oldBranch, newPr.html_url);
  }
}

/**
 * Get the open PR for a given branch.
 */
async function getNewPr(thisRepo: Github, newBranch: string) {
  const [newPr] = await thisRepo.getOpenPrsFromBranch(newBranch);
  if (!newPr) throw Error(`No PR found for branch ${newBranch}`);
  return newPr;
}

/**
 * Get branches that start with the branchNameRoot and are not the new branch.
 */
async function getBumpBranches(thisRepo: Github, newBranch: string) {
  const allBranches = await thisRepo.listBranches();
  return allBranches
    .filter(({ name }) => name.startsWith(branchNameRoot) && name !== newBranch)
    .map(({ name }) => name);
}

/**
 * Close all PRs for a given branch and delete the branch.
 */
async function closePrsAndDeleteBranch(
  thisRepo: Github,
  oldBranch: string,
  newPrUrl: string
) {
  try {
    const prs = await thisRepo.getOpenPrsFromBranch(oldBranch);
    await Promise.all(prs.map(pr => closePr(thisRepo, pr, newPrUrl)));
    await deleteBranch(oldBranch);
  } catch (error) {
    console.error(`Error handling branch ${oldBranch}:`, error);
  }
}

/**
 * Close a single PR with a comment.
 */
async function closePr(
  thisRepo: Github,
  pr: { number: number },
  newPrUrl: string
) {
  try {
    await thisRepo.createCommentInPr({
      number: pr.number,
      body: `Newer version available, closing for ${newPrUrl}`
    });
    await thisRepo.closePR(pr.number);
    console.log(
      `Closed PR #${pr.number} and commented: 'Newer version available, closing for ${newPrUrl}'`
    );
  } catch (error) {
    console.error(`Error commenting and closing PR ${pr.number}`, error);
  }
}

/**
 * Delete a branch from the repository.
 */
async function deleteBranch(branchName: string) {
  try {
    await shell(`git push origin --delete ${branchName}`);
    console.log(`Deleted branch: ${branchName}`);
  } catch (error) {
    console.error(`Error deleting branch ${branchName}`, error);
  }
}
