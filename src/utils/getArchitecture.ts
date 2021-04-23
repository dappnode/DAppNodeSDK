import { Architecture } from "../types";
import { shell } from "./shell";

/**
 * Return what kind of architecture is using the machine where the build is done
 */
export async function getArchitecture(): Promise<Architecture> {
  const systemInfo = await shell(`uname -a`);
  // we will check if the machine uses arm, arm architecture usually shows something like this
  //const systemInfo = `Linux raspberry 4.4.48-v7+ #964 SMP Mon Feb 13 16:57:51 GMT 2017 armv7l GNU/Linux`;

  const match = systemInfo.match(/(arm)|(ARM)/g);
  let res: Architecture;
  if (match) {
    res = `linux/arm64`;
  } else {
    res = `linux/amd64`;
  }
  return res;
}
