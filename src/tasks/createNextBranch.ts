import Listr from "listr";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { getManifestPath } from "../utils/manifest";
import { getComposePath } from "../utils/compose";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types";
import { shell } from "../utils/shell";
import { Github } from "../providers/github/Github";
import { defaultComposeFileName, defaultDir } from "../params";
import { getGitHead } from "../utils/git";

/**
 * Create (or edit) a Github release, then upload all assets
 */
export function createNextBranch({
  dir = defaultDir,
  compose_file_name = defaultComposeFileName,
  verbose,
  silent
}: CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  const composeFileName = compose_file_name;
  // Gather repo data, repoSlug = "dappnode/DNP_ADMIN"
  const github = new Github(dir);

  return new Listr<ListrContextBuildAndPublish>(
    [
      // Create the next version branch and advance versions
      // - Run `dappnodesdk increase patch` to compute next version
      // - Run `git checkout -b v${FUTURE_VERSION}`
      // - git add dappnode_package.json docker-compose.yml
      // - git commit -m "Advance manifest and docker-compose versions to new version: $FUTURE_VERSION"
      // - git push origin $BRANCH_NAME
      {
        title: "Create next version branch",
        task: async (ctx, task) => {
          try {
            // Openning next version branches in dev branches is confusing and never usefull
            // Actual releases are always done in master.
            const gitData = await getGitHead();
            const currenBranch = gitData.branch;
            if (currenBranch !== "master") {
              task.skip(`Next version branches are only created from master`);
              return;
            }

            const manifestPath = getManifestPath();
            const composePath = getComposePath(composeFileName);
            const nextVersion = await increaseFromLocalVersion({
              type: "patch",
              dir,
              compose_file_name
            });
            const branch = `v${nextVersion}`;

            // Check if branch exists in Github
            task.output = "Checking next version branch...";
            const remoteBranchInfo = await shell(
              `git ls-remote --heads origin ${branch}`
            );
            if (remoteBranchInfo) {
              task.skip(`Next version branch ${branch} already exists`);
              return;
            }

            // Make sure git is configured in this environment
            // Otherwise it will fail when run in a CI environemnt
            // `git config user.email` returns exit code 1 if not configured
            if (
              process.env.CI &&
              !(await shell(`git config user.email`).catch(() => false))
            ) {
              await shell(`git config user.email next-branch@bot`);
              await shell(`git config user.name next-branch`);
            }

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
            await github.openPR({
              from: branch,
              to: "master",
              title: `${branch} Release`
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
