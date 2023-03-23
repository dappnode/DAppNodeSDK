import { Manifest } from "../files/index.js";

export function getIsCore(manifest: Manifest): boolean {
  return manifest.type === "dncore";
}
