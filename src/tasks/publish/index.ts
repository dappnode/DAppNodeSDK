import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextPublish } from "../../types.js";
import { getFetchNextVersionsFromApmTask } from "./subtasks/getFetchApmVersionsTask.js";
import { getBuildAndUploadTask } from "./subtasks/getBuildAndUploadTask.js";
import { getGenerateTxTask } from "./subtasks/getGenerateTxsTask.js";
import { getCreateGithubReleaseTask } from "./subtasks/getCreateGithubReleaseTask.js";
import { getVerifyEthConnectionTask } from "./subtasks/getVerifyEthConnectionTask.js";
import { getUpdateFilesTask } from "./subtasks/getUpdateFilesTask.js";

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
  packagesToBuildProps,
}: PublishOptions): ListrTask<ListrContextPublish>[] {
  return [
    getVerifyEthConnectionTask({ ethProvider }),
    getFetchNextVersionsFromApmTask({
      releaseType,
      ethProvider,
      packagesToBuildProps
    }),
    getUpdateFilesTask({
      rootDir: dir,
      variantsDirPath,
      composeFileName,
      packagesToBuildProps
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
        packagesToBuildProps,
        variantsDirPath
      },
      verbosityOptions
    }),
    getGenerateTxTask({
      dir,
      composeFileName,
      developerAddress,
      ethProvider,
      verbosityOptions,
      packagesToBuildProps
    }),
    getCreateGithubReleaseTask({
      dir,
      githubRelease: Boolean(githubRelease),
      verbosityOptions,
      composeFileName
    })
  ];
}
