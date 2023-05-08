import { Manifest } from "@dappnode/types";

export function getIsCore(manifest: Manifest): boolean {
  return manifest.type === "dncore";
}
