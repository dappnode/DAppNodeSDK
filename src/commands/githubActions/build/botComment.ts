import { ListrContextBuildAndPublish } from "../../../types.js";
import { getInstallDnpLink } from "../../../utils/getLinks.js";

const botCommentTag = "(by dappnodebot/build-action)";

/**
 * Constructs a comment summarizing build results for a specific commit.
 * This comment includes a tag to identify it, allowing easy retrieval or replacement.
 *
 * @param {string} commitSha - The Git commit SHA associated with the build.
 * @param {ListrContextBuildAndPublish} buildResults - The results of the build process.
 * @return {string} A formatted comment with links to install the built packages and their hashes.
 */
export function getBuildBotComment({
  commitSha,
  buildResults
}: {
  commitSha: string;
  buildResults: ListrContextBuildAndPublish;
}): string {
  const buildEntries = Object.entries(buildResults)
    .map(([dnpName, { releaseMultiHash }], index) =>
      formatBuildEntry({ dnpName, releaseMultiHash, index })
    )
    .join("\n\n");

  return `Dappnode bot has built and pinned the built packages to an IPFS node, for commit: ${commitSha}

This is a development version and should **only** be installed for testing purposes.

${buildEntries}

${botCommentTag}
`;
}

function formatBuildEntry({
  dnpName,
  releaseMultiHash,
  index
}: {
  dnpName: string;
  releaseMultiHash: string;
  index: number;
}) {
  const installLink = getInstallDnpLink(releaseMultiHash);
  return `${index + 1}. Package **${dnpName}**
  
  [Install link](${installLink})
  
  Hash: \`${releaseMultiHash}\``;
}

/**
 * Locates any existing comment by a persistent tag used in all build bot comments
 */
export function isTargetComment(commentBody: string): boolean {
  return commentBody.includes(botCommentTag);
}
