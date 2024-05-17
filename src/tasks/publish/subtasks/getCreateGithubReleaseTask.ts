import { ListrTask } from "listr";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { ListrContextPublish } from "../../../types.js";
import { createGithubRelease } from "../../createGithubRelease/index.js";

export function getCreateGithubReleaseTask({
  githubRelease,
  dir,
  composeFileName,
  verbosityOptions
}: {
  githubRelease: boolean;
  dir: string;
  composeFileName: string;
  verbosityOptions: VerbosityOptions;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Release on github",
    skip: () => !githubRelease,
    task: () =>
      createGithubRelease({
        rootDir: dir,
        compose_file_name: composeFileName,
        verbosityOptions
      })
  };
}
