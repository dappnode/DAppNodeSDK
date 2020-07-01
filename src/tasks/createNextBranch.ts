import Listr from "listr";
import { Octokit } from "@octokit/rest";
// Utils
import { getRepoSlugFromManifest } from "../utils/getRepoSlugFromManifest";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { getManifestPath } from "../utils/manifest";
import { getComposePath } from "../utils/compose";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types";
import { shell } from "../utils/shell";

/**
 * Create (or edit) a Github release, then upload all assets
 */

export function createNextBranch({
  dir,
  verbose,
  silent
}: CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  // OAuth2 token from Github
  if (!process.env.GITHUB_TOKEN)
    throw Error("GITHUB_TOKEN ENV (OAuth2) is required");
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });

  // Gather repo data, repoSlug = "dappnode/DNP_ADMIN"
  const repoSlug =
    getRepoSlugFromManifest(dir) || process.env.TRAVIS_REPO_SLUG || "";
  const [owner, repo] = repoSlug.split("/");
  if (!repoSlug) throw Error("No repoSlug provided");
  if (!owner) throw Error(`repoSlug "${repoSlug}" hasn't an owner`);
  if (!repo) throw Error(`repoSlug "${repoSlug}" hasn't a repo`);

  return new Listr<ListrContextBuildAndPublish>(
    [
      /**
       * Create the next version branch and advance versions
       * - Run `dappnodesdk increase patch` to compute next version
       * - Run `git checkout -b v${FUTURE_VERSION}`
       * - git add dappnode_package.json docker-compose.yml
       * - git commit -m "Advance manifest and docker-compose versions to new version: $FUTURE_VERSION"
       * - git push origin $BRANCH_NAME
       */
      {
        title: "Create next version branch",
        task: async (ctx, task) => {
          try {
            const manifestPath = getManifestPath();
            const composePath = getComposePath();
            const nextVersion = await increaseFromLocalVersion({
              type: "patch",
              dir
            });
            const branch = `v${nextVersion}`;

            // Check if branch exists in Github
            task.output = "Checking next version branch...";
            const remoteBranchInfo = await shell(
              `git ls-remote --heads origin ${branch}`
            );
            if (remoteBranchInfo)
              throw Error(
                `Next version branch ${branch} already exists in origin: ${remoteBranchInfo}`
              );

            // Using the git CLI directly since you can't create and push
            // a commit that has two files (at least in an easy way)
            // CI runs should be authorized to use the CLI directly
            // while running locally should have the origin configured and work OK
            await shell(`git checkout -b ${branch}`);
            await shell(`git add ${manifestPath} ${composePath}`);
            await shell(`git commit -m "Bump to new version: ${nextVersion}"`);
            task.output = "Pushing bump versions commit...";
            await shell(`git push --set-upstream origin ${branch}`);

            // Open a PR from next branch to master
            task.output = "Openning a PR to master...";
            await octokit.pulls.create({
              owner,
              repo,
              title: `${branch} Release`,
              head: branch, // from
              base: "master" // to
            });
          } catch (e) {
            // Non-essential step, don't stop release for a failure on this task
            console.log(`Error creating next version branch:\n${e.stack}`);
          }
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}
