import { shell } from "./shell";

export async function isGitUserEmailSet(): Promise<boolean> {
  try {
    const currentUser = await shell(`git config user.name`);
    const currentEmail = await shell(`git config user.email`);
    //console.log(currentUser.length);

    // we need to check it out if thee value exists
    if (currentUser.length > 0 || currentEmail.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    // Empty value or not value defined returns shell error, we catch that error and return false
    return false;
  }
}

const ex = isGitUserEmailSet().then(res => {
  return res;
});
console.log(ex);
