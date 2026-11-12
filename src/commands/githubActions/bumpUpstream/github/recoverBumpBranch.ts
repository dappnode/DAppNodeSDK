import { shell } from "../../../../utils/shell.js";

/**
 * Recovers a bump branch an earlier run pushed but could not open a PR for:
 * checks it out from origin, so the build that follows uses its content, then
 * opens its PR. With SKIP_COMMIT set it only checks the branch out, as a
 * debugging run makes no remote changes.
 */
export async function recoverBumpBranch({
  dir,
  branchName,
  skipCommit,
  openPr
}: {
  dir: string;
  branchName: string;
  skipCommit: boolean;
  openPr: () => Promise<void>;
}): Promise<void> {
  await shell(["git", "check-ref-format", "--branch", branchName], {
    cwd: dir
  });
  await shell(
    [
      "git",
      "fetch",
      "origin",
      `+refs/heads/${branchName}:refs/remotes/origin/${branchName}`
    ],
    { cwd: dir }
  );
  await shell(
    ["git", "checkout", "-B", branchName, `refs/remotes/origin/${branchName}`],
    { cwd: dir }
  );

  if (skipCommit) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await openPr();
}
