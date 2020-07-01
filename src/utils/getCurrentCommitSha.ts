import { shell } from "./shell";

/**
 * @returns sha = "d51ad2ff51488eaf2bfd5d6906f8b20043ed3b42"
 */
export async function getCurrentCommitSha(): Promise<string> {
  return await shell("git rev-parse HEAD");
}
