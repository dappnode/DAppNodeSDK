import { Architecture } from "../types";
import os from "os";

/**
 * Returns the architecture of the host machine doing the build
 */
export function getArchitecture(): Architecture {
  // Returns the operating system CPU architecture for which the Node.js binary was compiled.
  const arch = os.arch();

  // TODO: DAppNode Packages are run in Linux-based systems. This solves the edge case when building in ARM
  if (arch === "arm64") {
    return "linux/arm64";
  } else {
    return "linux/amd64";
  }
}
