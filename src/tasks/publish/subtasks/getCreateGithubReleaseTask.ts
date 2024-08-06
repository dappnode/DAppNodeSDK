import { ListrTask } from "listr";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { ListrContextPublish } from "../../../types.js";
import { createGithubRelease } from "../../createGithubRelease/index.js";

export function getCreateGithubReleaseTask({
  githubRelease,
  dir,
  composeFileName,
  verbosityOptions,
  isMultiVariant
}: {
  githubRelease: boolean;
  dir: string;
  composeFileName: string;
  verbosityOptions: VerbosityOptions;
  isMultiVariant: boolean;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Release on github",
    skip: () => !githubRelease,
    task: () =>
      createGithubRelease({
        dir,
        compose_file_name: composeFileName,
        verbosityOptions,
        isMultiVariant
      })
  };
}
