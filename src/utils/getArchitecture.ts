import { Architecture } from "../types";
import os from "os";

/**
 * Return what kind of architecture is using the machine where the build is done
 */
export async function getArchitecture(): Promise<Architecture> {
  const arch = os.arch(); // Returns the operating system CPU architecture for which the Node.js binary was compiled.

  //check if the machine uses arm64
  let res: Architecture;

  if (arch === "arm64") {
    res = `linux/arm64`;
  } else {
    res = `linux/amd64`;
  }
  return res;
}
