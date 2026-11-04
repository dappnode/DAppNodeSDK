import { readManifest } from "./readManifest.js";
import { ManifestPaths } from "./types.js";

/**
 * Gets the repo slug from a manifest, using the repository property.
 * Accepts `https://github.com/owner/repo(.git)` and the npm-style `git+https://` form.
 *
 * @returns repoSlug = "dappnode/DNP_ADMIN", or "" if the repository is not on GitHub
 */
export function getRepoSlugFromManifest(paths: ManifestPaths): string {
  const { manifest } = readManifest([paths]);
  const { type, url } = manifest.repository || {};
  // Ignore faulty manifests
  if (type !== "git" || !url) return "";
  return parseGithubRepoSlug(url);
}

export function parseGithubRepoSlug(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "";
  }
  // Match the host exactly; a substring check would accept URLs that only mention github.com.
  if (!["https:", "git+https:"].includes(parsed.protocol)) return "";
  if (parsed.hostname !== "github.com") return "";
  const [owner, repo] = parsed.pathname
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/, "")
    .split("/");
  return owner && repo ? `${owner}/${repo}` : "";
}
