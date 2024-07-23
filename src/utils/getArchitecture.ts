import os from "os";
import { Architecture } from "@dappnode/types";

/**
 * Returns the architecture of the host machine doing the build
 */
export function getOsArchitecture(): Architecture | "unsupported" {
  // Returns the operating system CPU architecture for which the Node.js binary was compiled.
  const arch = os.arch();

  // TODO: DAppNode Packages are run in Linux-based systems. This solves the edge case when building in ARM
  if (arch === "arm64") {
    return "linux/arm64";
  } else if (arch === "x64") {
    return "linux/amd64";
  } else {
    return "unsupported";
  }
}
