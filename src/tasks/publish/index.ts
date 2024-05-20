import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextPublish } from "../../types.js";
import { getFetchApmVersionsTask } from "./subtasks/getFetchApmVersionsTask.js";
import { getBuildAndUploadTask } from "./subtasks/getBuildAndUploadTask.js";
import { getGenerateTxTask } from "./subtasks/getGenerateTxsTask.js";
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
  variantsMap
}: PublishOptions): ListrTask<ListrContextPublish>[] {
  return [
    getVerifyEthConnectionTask({ ethProvider }),
    getFetchApmVersionsTask({
      releaseType,
      ethProvider,
      rootDir: dir,
      composeFileName,
      variantsMap
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
        variantsMap,
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
      variantsMap
    }),
    getCreateGithubReleaseTask({
      dir,
      githubRelease: Boolean(githubRelease),
      verbosityOptions,
      composeFileName
    })
  ];
}
