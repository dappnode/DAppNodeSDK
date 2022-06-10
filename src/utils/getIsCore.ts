import { Manifest } from "../files";

export function getIsCore(manifest: Manifest): boolean {
  return manifest.type === "dncore";
}
