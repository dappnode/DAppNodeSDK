import { getGitHead } from "../../../utils/git.js";
import { ListrContextBuildAndPublish } from "../../../types.js";
import { ListrTask } from "listr";
import { Github } from "../../../providers/github/Github.js";
import { getNextGitTag } from "./getNextGitTag.js";
/**
 * Handle tags
 *
 * - If the release is triggered in CI,
 *  the trigger tag must be remove and replaced by the release tag
 *
 * - If the release is triggered locally, the commit should be
 * tagged and released on that tag
 */
export function getHandleTagsTask({
  github
}: {
  github: Github;
}): ListrTask<ListrContextBuildAndPublish> {
  const isCi = process.env.CI;
  const triggerTag = process.env.GITHUB_REF || process.env.TRAVIS_TAG;

  return {
    title: `Handle tags`,
    task: async (ctx, task) => {
      // TODO: Do this for each release
      const [, { nextVersion }] = Object.entries(ctx)[0];

      // Sanity check, make sure repo exists
      await github.assertRepoExists();

      const tag = getNextGitTag(nextVersion);

      // If the release is triggered in CI,
      // the trigger tag must be removed ("release/patch")
      if (isCi && triggerTag && triggerTag.startsWith("release"))
        await github.deleteTagIfExists(triggerTag);

      // Check if the release tag exists remotely. If so, remove it
      await github.deleteTagIfExists(tag);

      const commitToTag = await getCommitToTag();

      // Tag the current commit with the release tag
      task.output = `Releasing commit ${commitToTag} at tag ${tag}`;
      await github.createTag(tag, commitToTag);
    }
  };
}

/**
 * Get the commit to be tagged
 *
 * - If on CI, use the current commit
 *
 * - Otherwise use the current HEAD commit
 */
async function getCommitToTag() {
  return (
    process.env.GITHUB_SHA ||
    process.env.TRAVIS_COMMIT ||
    (await getGitHead()).commit
  );
}
