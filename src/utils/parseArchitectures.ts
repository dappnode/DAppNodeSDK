import { Architecture, architectures } from "@dappnode/types";
import { getArchitecture } from "./getArchitecture.js";

export function parseArchitectures(rawArchs: Architecture[] | undefined): Architecture[] {

  if (!rawArchs) return [getArchitecture()];

  for (const rawArch of rawArchs)
    if (!architectures.includes(rawArch))
      throw Error(
        `Invalid architecture '${rawArch}', allowed values: ${architectures.join(", ")}`
      );

  if (!rawArchs.includes("linux/amd64"))
    throw Error(`architectures array must include default arch 'linux/amd64'`);

  return rawArchs;
}
