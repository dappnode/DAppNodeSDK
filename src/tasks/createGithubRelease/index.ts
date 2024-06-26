import Listr from "listr";
import { defaultDir } from "../../params.js";
import { CliGlobalOptions, ListrContextPublish } from "../../types.js";
import { Github } from "../../providers/github/Github.js";
import { VerbosityOptions } from "../../commands/build/types.js";
import { getHandleTagsTask } from "./subtasks/getHandleTagsTask.js";
import { getCreateReleaseTask } from "./subtasks/getCreateReleaseTask.js";

/**
 * Create (or edit) a Github release, then upload all assets
 */
export function createGithubRelease({
  dir: rootDir = defaultDir,
  compose_file_name: composeFileName,
  verbosityOptions
}: {
  verbosityOptions: VerbosityOptions;
} & CliGlobalOptions): Listr<ListrContextPublish> {
  // OAuth2 token from Github
  if (!process.env.GITHUB_TOKEN)
    throw Error("GITHUB_TOKEN ENV (OAuth2) is required");

  const github = Github.fromLocal(rootDir);

  return new Listr<ListrContextPublish>(
    [
      getHandleTagsTask({ github }),
      getCreateReleaseTask({
        github,
        composeFileName
      })
    ],
    verbosityOptions
  );
}
