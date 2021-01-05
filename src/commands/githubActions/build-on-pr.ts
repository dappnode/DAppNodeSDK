import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../types";
import { botCommentTag, defaultDir } from "../../params";
import {
  getGithubEventData,
  GithubActionsEventData
} from "../../providers/github/githubActions";
import { buildHandler } from "../build";
import { Github } from "../../providers/github/Github";
import { getInstallDnpLink } from "../../utils/getLinks";

export const buildOnPr: CommandModule<CliGlobalOptions, CliGlobalOptions> = {
  command: "build-on-pr",
  describe:
    "Build and upload test release and post a comment with install link to the triggering PR",
  builder: {},
  handler: async (args): Promise<void> => await buildOnPrHandler(args)
};

/**
 * Common handler for CLI and programatic usage
 */
export async function buildOnPrHandler({
  dir = defaultDir
}: CliGlobalOptions): Promise<void> {
  // Get info about pushed PR
  const eventData = getGithubEventData<
    GithubActionsEventData["pull_request"]
  >();
  const pullRequestNumber = eventData.number;
  if (typeof pullRequestNumber !== "number") {
    const eventDataString = JSON.stringify(eventData, null, 2);
    throw Error(`Event data does not contain PR number: \n ${eventDataString}`);
  }

  // Build new release with Listr verbose output
  const { releaseMultiHash } = await buildHandler({
    provider: "pinata",
    upload_to: "ipfs",
    require_git_data: true,
    delete_old_pins: true,
    verbose: true
  });

  // Connect to Github Octokit REST API and post or edit a comment on PR
  const github = new Github(dir);

  const shortCommit = eventData.pull_request?.head?.sha?.slice(0, 8);
  const installLink = getInstallDnpLink(releaseMultiHash);
  const body = `DAppNode bot has built commit ${shortCommit} and pinned the release to an IPFS node.

This is a development version and should **only** be installed for testing purposes, [install link](${installLink})

\`\`\`
${releaseMultiHash}
\`\`\`

${botCommentTag}
`;

  await github.commentToPr({
    pullRequestNumber,
    body,
    isTargetComment: commentBody => commentBody.includes(botCommentTag)
  });
}
