import { shell } from "./shell";

export async function isGitUserSet(): Promise<boolean> {
  try {
    const currentUser = await shell(`git config user.name`);

    // we need to check it out if thee value exists
    if (currentUser.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    // Empty value or not value defined returns shell error, we catch that error and return false
    console.log("here");
    return false;
  }
}
