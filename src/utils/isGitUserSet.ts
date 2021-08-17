import { shell } from "./shell";

/**
 *
 * @returns true if git user.name is defined in the machine
 */

export async function isGitUserSet(): Promise<boolean> {
  try {
    const currentUser = await shell(`git config user.name`);
    return Boolean(currentUser);
  } catch (e) {
    return false;
  }
}
