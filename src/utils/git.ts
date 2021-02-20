import { shell } from "./shell";

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
 * Return gitHead if the repo is initialized and includes a revision
 * Otherwise, ignore
 */
export async function getGitHeadIfAvailable(options?: {
  requireGitData?: boolean;
}): Promise<GitHead | undefined> {
  try {
    return await getGitHead();
  } catch (e) {
    if (options?.requireGitData) {
      e.message = `Error on getGitHead: ${e.message}`;
      throw e;
    } else {
      return undefined;
    }
  }
}

/**
 * @param branch dappnodebot/bump-upstream/go-ipfs@v0.7.0
 */
export async function getLocalBranchExists(branch: string): Promise<boolean> {
  try {
    const branchSha = await shell(
      `git show-ref --verify -s refs/heads/${branch}`
    );
    return Boolean(branchSha);
  } catch (e) {
    return false;
  }
}
