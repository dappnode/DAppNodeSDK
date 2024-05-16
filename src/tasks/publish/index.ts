import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextPublish } from "../../types.js";
import { getFetchApmVersionTask } from "./subtasks/getFetchApmVersionTask.js";
import { getBuildAndUploadTask } from "./subtasks/getBuildAndUploadTask.js";
import { getGenerateTxTask } from "./subtasks/getGenerateTxTask.js";
import { getCreateGithubReleaseTask } from "./subtasks/getCreateGithubReleaseTask.js";
import { getVerifyEthConnectionTask } from "./subtasks/getVerifyEthConnectionTask.js";

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
}: PublishOptions): ListrTask<ListrContextPublish>[] {
  return [
    getVerifyEthConnectionTask({ ethProvider }),
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
        // TODO: Add multi-variant package build options here
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
