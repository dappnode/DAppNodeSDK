import { Architecture } from "../types";

// const archs: { [key in Architecture]: string } = {
//   amd64: "amd64",
//   arm64: "arm64"
// };

export function parseArchitectures(
  architectures: Architecture[]
): Architecture[] {
  for (const architecture of architectures) {
    if (architecture.startsWith("linux/"))
      throw Error(`architectures must be defined without a "linux/" prefixed`);
    if (architecture.includes("/"))
      throw Error(`architectures must not include the character "/"`);
  }

  if (!architectures.includes("amd64"))
    throw Error(`architectures array must include arch "amd64"`);

  return architectures;
}
