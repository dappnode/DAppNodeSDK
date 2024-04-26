import { ListrContextBuildAndPublish } from "../../../types.js";
import { getInstallDnpLink } from "../../../utils/getLinks.js";

const botCommentTag = "(by dappnodebot/build-action)";

/**
 * Returns formated comment with build result info
 * Comment includes `botCommentTag` which is then used by `isTargetComment()`
 * to locate any existing comment
 */
export function getBuildBotComment({
  commitSha,
  buildResults
}: {
  commitSha: string;
  buildResults: ListrContextBuildAndPublish[]
}): string {
  return `Dappnode bot has built and pinned the built packages to an IPFS node, for commit: ${commitSha}

This is a development version and should **only** be installed for testing purposes.

${buildResults.map((result, index) => `${index + 1}. Package **${result.dnpName}**

\t[Install link](${getInstallDnpLink(result.releaseMultiHash)})

\tHash: \`${result.releaseMultiHash}\``)}

${botCommentTag}
`;
}

/**
 * Locates any existing comment by a persistent tag used in all build bot comments
 */
export function isTargetComment(commentBody: string): boolean {
  return commentBody.includes(botCommentTag);
}
