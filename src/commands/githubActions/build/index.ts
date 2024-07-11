import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir } from "../../../params.js";
import { getGithubContext } from "../../../providers/github/githubActions.js";
import { buildHandler } from "../../build/handler.js";
import { Github } from "../../../providers/github/Github.js";
import { parseRef } from "../../../providers/github/utils.js";
import { getBuildBotComment, isTargetComment } from "./botComment.js";
import { cleanPinsFromDeletedBranches } from "./cleanPinsFromDeletedBranches.js";
import { BuildActionOptions } from "./types.js";

// This action should be run on 'push' and 'pull_request' events
//
// For 'push' events ('branch'):
//   Does a build test and uploads release to Pinata tagged with branch
//   and commit. It will also locate any PRs from that branch and comment
//   the resulting hash, so it can be used by testers.
//   Another job 'unpin-on-ref-delete' should delete eventually the
//   releases generated by this action
//
// For 'push' events ('tags'):
//   Skip for now. On 'tag' another action should publish instead of just
//   building, maybe it can be done by this job, but consider alternatives
//
// For 'pull_request' events:
//   Does a build test but doesn't upload the result anywhere

export const gaBuild: CommandModule<BuildActionOptions, CliGlobalOptions> = {
  command: "build",
  describe:
    "Build and upload test release and post a comment with install link to the triggering PR",
  builder: {
    all_variants: {
      alias: "all-variants",
      description: `Build all package variants at once, by merging the dappnode_package.json and docker-compose.yml files in the root of the project with the specific ones defined for each package variant`,
      type: "boolean"
    },
    variants: {
      alias: "variant",
      description: `Specify the package variants to build (only for packages that support it). Defined by comma-separated list of variant names. Example: "variant1,variant2"`,
      type: "string"
    }
  },
  handler: async (args): Promise<void> => await gaBuildHandler(args)
};

/**
 * Common handler for CLI and programatic usage
 */
async function gaBuildHandler({
  dir = defaultDir,
  all_variants,
  variants
}: BuildActionOptions): Promise<void> {
  const { eventName, sha: commitSha, ref: refString } = getGithubContext();
  const ref = parseRef(refString);

  // Clean pins that were added from past runs.
  // Doing it here prevents having to add two workflows per repo.
  // Also, ensures that pins are deleted eventually, even if this fails sometimes
  try {
    await cleanPinsFromDeletedBranches({ dir });
  } catch (e) {
    console.error("Error on cleanPinsFromDeletedBranches", e);
  }

  if (
    eventName === "push" &&
    ref.type === "branch" &&
    // Do not upload to pinata for branches that are never deleted
    ref.branch !== "HEAD" &&
    ref.branch !== "master" &&
    ref.branch !== "main"
  ) {
    await buildAndComment({
      dir,
      commitSha,
      branch: ref.branch,
      all_variants,
      variants
    });
  } else if (eventName === "push" || eventName === "pull_request") {
    // Consider that for 'pull_request' commitSha does not represent a known commit
    // The incoming branch is merged into the target branch and the resulting
    // new commit is tested. gitHead() will return 'HEAD' for branch and a foreign commit
    // Pinata example: 'dappnodesdk.public HEAD 2f149cf'
    // See https://github.community/t/github-sha-not-the-same-as-the-triggering-commit/18286

    // By default just do a test build and skip_save
    await buildHandler({
      provider: "dappnode",
      upload_to: "ipfs",
      skip_save: true,
      verbose: true,
      all_variants,
      variants
    });
  } else if (!eventName) {
    throw Error("Not in Github action context");
  } else {
    throw Error(`Unsupported event ${eventName}`);
  }
}

export async function buildAndComment({
  dir,
  commitSha,
  branch,
  all_variants,
  variants
}: {
  dir: string;
  commitSha: string;
  branch: string;
  all_variants?: boolean;
  variants?: string;
}): Promise<void> {
  // Connect to Github Octokit REST API and post or edit a comment on PR
  const github = Github.fromLocal(dir);

  const buildResults = await buildHandler({
    provider: "pinata",
    upload_to: "ipfs",
    require_git_data: true,
    delete_old_pins: true,
    verbose: true,
    all_variants,
    variants
  });

  const body = getBuildBotComment({ commitSha, buildResults });

  console.log(`Build bot comment: \n\n${body}`);

  const prs = await github.getOpenPrsFromBranch(branch);
  console.log(`
    Repo: ${github.repoSlug}
    Branch ${branch}
    PRs: ${prs.map(pr => pr.number).join(", ")}
  `);

  await Promise.all(
    prs.map(pr =>
      github.commentToPr({ number: pr.number, body, isTargetComment })
    )
  );
}
