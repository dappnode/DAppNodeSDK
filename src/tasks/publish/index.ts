import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextPublish } from "../../types.js";
import { getFetchApmVersionsTask } from "./subtasks/getFetchApmVersionsTask.js";
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
  verbosityOptions,
  variantsDirPath,
  variants
}: PublishOptions): ListrTask<ListrContextPublish>[] {
  return [
    getVerifyEthConnectionTask({ ethProvider }),
    getFetchApmVersionsTask({
      releaseType,
      ethProvider,
      rootDir: dir,
      composeFileName,
      variants,
      variantsDirPath
    }),
    getBuildAndUploadTask({
      buildOptions: {
        dir,
        composeFileName,
        contentProvider,
        uploadTo,
        userTimeout,
        requireGitData,
        deleteOldPins,
        variants: null
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
