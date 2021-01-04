import { shell, ShellError } from "./shell";

export interface GitHead {
  /**
   * From `git rev-parse --verify HEAD`
   * Returns `"d51ad2ff51488eaf2bfd5d6906f8b20043ed3b42"`
   */
  commit: string;
  /**
   * From `git rev-parse --abbrev-ref HEAD`
   * Returns `"master"`
   */
  branch: string;
}

/**
 * @returns example:
 * ```
 * commit: "d51ad2ff51488eaf2bfd5d6906f8b20043ed3b42"
 * branch: "dapplion/prepare-build-action"
 * ```
 */
export async function getGitHead(): Promise<GitHead> {
  const commit = await shell("git rev-parse --verify HEAD");
  const branch = await shell("git rev-parse --abbrev-ref HEAD");
  return { commit, branch };
}

/**
 * Check if one commit is a descendant of another commit
 *
 * ```bash
 * git merge-base --is-ancestor <maybe-ancestor-commit> <descendant-commit>
 * ```
 * > Check if the first is an ancestor of the second, and exit with status 0 if true,
 * or with status 1 if not. Errors are signaled by a non-zero status that is not 1.
 *
 * From https://stackoverflow.com/questions/3005392/how-can-i-tell-if-one-commit-is-a-descendant-of-another-commit
 */
export async function gitIsAncestor(
  maybeAncestorCommit: string,
  descendantCommit: string
): Promise<boolean> {
  try {
    await shell(
      `git merge-base --is-ancestor ${maybeAncestorCommit} ${descendantCommit}`
    );
    return true;
  } catch (e) {
    return false;
    // throwing on exitCode !== 1 breaks a lot of builds
    // Commits may not exist due to a rebase, then it throws with
    //   Command failed: git merge-base --is-ancestor cd31553a839439ee65f10811de63ee3b44f5cdfb e4f04e69bc0137b5761e24a13883826b0c897ef5
    //   fatal: Not a valid commit name cd31553a839439ee65f10811de63ee3b44f5cdfb
    //
    // All pins will be cleaned eventually when their branch is deleted
  }
}
