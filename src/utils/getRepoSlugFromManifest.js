const { readManifest } = require("../utils/manifest");

const githubBaseUrl = "https://github.com/";

/**
 * Gets the repo slug from a manifest, using the repository property
 *
 * @param {string} dir
 * @returns {string} repoSlug = "dappnode/DNP_ADMIN"
 */
function getRepoSlugFromManifest({ dir }) {
  const manifest = readManifest({ dir });
  const { type, url } = manifest.repository || {};
  // Ignore faulty manifests
  if (type !== "git" || !url || !url.includes(githubBaseUrl)) return;
  // Get repo slug from the repoUrl, i.e. "https://github.com/dappnode/DNP_VPN"
  const repoSlug = url.split(githubBaseUrl)[1] || "";
  return repoSlug.replace(/\/+$/, "").replace(".git", "");
}

module.exports = getRepoSlugFromManifest;
