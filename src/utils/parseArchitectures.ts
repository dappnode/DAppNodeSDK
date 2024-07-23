import { Architecture, architectures } from "@dappnode/types";

/**
 *
 * @param rawArchs
 * @returns
 */
export function parseArchitectures({
  rawArchs = ["linux/amd64"]
}: {
  rawArchs?: Architecture[];
}): Architecture[] {
  for (const rawArch of rawArchs)
    if (!architectures.includes(rawArch))
      throw Error(
        `Invalid architecture '${rawArch}', allowed values: ${architectures.join(
          ", "
        )}`
      );

  if (!rawArchs.includes("linux/amd64"))
    throw Error(`architectures array must include default arch 'linux/amd64'`);

  return rawArchs;
}
