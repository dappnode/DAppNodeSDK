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
