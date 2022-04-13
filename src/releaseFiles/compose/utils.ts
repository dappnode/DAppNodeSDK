import { Manifest } from "../manifest/types";

export function getIsCore(manifest: Manifest): boolean {
  return manifest.type === "dncore";
}
