import { ReleaseFileType, ReleaseFilePaths } from "../types";
import { readReleaseFile } from "../releaseFiles/readReleaseFile";

/**
 * Gets the repo slug from a manifest, using the repository property
 *
 * @returns repoSlug = "dappnode/DNP_ADMIN"
 */
export function getRepoSlugFromManifest(paths: ReleaseFilePaths): string {
  const githubBaseUrl = "https://github.com/";

  const manifest = readReleaseFile(ReleaseFileType.manifest, paths);
  const { type, url } = manifest.releaseFile.repository || {};
  // Ignore faulty manifests
  if (type !== "git" || !url || !url.includes(githubBaseUrl)) return "";
  // Get repo slug from the repoUrl, i.e. "https://github.com/dappnode/DNP_VPN"
  const repoSlug = url.split(githubBaseUrl)[1] || "";
  return repoSlug.replace(/\/+$/, "").replace(".git", "");
}
