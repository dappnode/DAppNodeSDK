import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { getFetchApmVersionTask } from "./getFetchApmVersionTask.js";
import { getBuildAndUploadTask } from "./getBuildAndUploadTask.js";
import { getGenerateTxTask } from "./getGenerateTxTask.js";
import { getCreateGithubReleaseTask } from "./getCreateGithubReleaseTask.js";

export function publish({
  releaseType,
  ethProvider,
  dir,
  composeFileName,
  contentProvider,
  uploadTo,
  userTimeout,
  requireGitData,
  deleteOldPins,
  developerAddress,
  githubRelease,
  verbosityOptions
}: PublishOptions): ListrTask<ListrContextBuildAndPublish>[] {
  return [
    getFetchApmVersionTask({ releaseType, ethProvider, dir, composeFileName }),
    getBuildAndUploadTask({
      buildOptions: {
        dir,
        composeFileName,
        contentProvider,
        uploadTo,
        userTimeout,
        requireGitData,
        deleteOldPins
        // TODO
      },
      verbosityOptions
    }),
    getGenerateTxTask({
      dir,
      composeFileName,
      developerAddress,
      ethProvider,
      verbosityOptions
    }),
    getCreateGithubReleaseTask({
      dir,
      githubRelease: Boolean(githubRelease),
      verbosityOptions,
      composeFileName
    })
  ];
}
