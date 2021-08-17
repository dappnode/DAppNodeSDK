import { shell } from "./shell";

/**
 *
 * @returns true if git user.email is defined in the machine
 */

export async function isGitEmailSet(): Promise<boolean> {
  try {
    const currentEmail = await shell(`git config user.email`);
    return Boolean(currentEmail);
  } catch (e) {
    return false;
  }
}
