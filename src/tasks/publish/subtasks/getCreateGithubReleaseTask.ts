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
    enabled: () => githubRelease, // Only create release if requested
    task: (ctx, task) => {
      // TODO: Generate 1 tx per package
      const [, { releaseMultiHash, releaseDir }] = Object.entries(ctx)[0];

      if (releaseMultiHash && releaseDir) {
        return createGithubRelease({
          dir,
          compose_file_name: composeFileName,
          buildDir: releaseDir,
          releaseMultiHash,
          verbosityOptions
        });
      } else {
        // TODO: Check if this is the correct way to handle this case
        task.output = "No release hash found. Skipping release creation.";
      }
    }
  };
}
