import { Architecture, architectures } from "../types";

const architecturesList = architectures.join(" ");

export function parseArchitectures(rawArchs: Architecture[]): Architecture[] {
  for (const rawArch of rawArchs)
    if (!architectures.includes(rawArch))
      throw Error(
        `Invalid architecture '${rawArch}', allowed values: ${architecturesList}`
      );

  if (!rawArchs.includes("linux/amd64"))
    throw Error(`architectures array must include default arch 'linux/amd64'`);

  return rawArchs;
}
