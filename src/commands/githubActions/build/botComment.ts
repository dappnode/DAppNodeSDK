import { getInstallDnpLink } from "../../../utils/getLinks";

const botCommentTag = "(by dappnodebot/build-action)";

/**
 * Returns formated comment with build result info
 * Comment includes `botCommentTag` which is then used by `isTargetComment()`
 * to locate any existing comment
 */
export function getBuildBotComment({
  commitSha,
  releaseMultiHash
}: {
  commitSha: string;
  releaseMultiHash: string;
}): string {
  const installLink = getInstallDnpLink(releaseMultiHash);

  return `DAppNode bot has built and pinned the release to an IPFS node, for commit: ${commitSha}

This is a development version and should **only** be installed for testing purposes, [install link](${installLink})

\`\`\`
${releaseMultiHash}
\`\`\`

${botCommentTag}
`;
}

/**
 * Locates any existing comment by a persistent tag used in all build bot comments
 */
export function isTargetComment(commentBody: string): boolean {
  return commentBody.includes(botCommentTag);
}
