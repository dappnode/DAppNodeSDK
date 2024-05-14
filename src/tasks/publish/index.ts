import { ListrTask } from "listr";
import { PublishOptions } from "./types.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { getFetchApmVersionTask } from "./subtasks/getFetchApmVersionTask.js";
import { getBuildAndUploadTask } from "./subtasks/getBuildAndUploadTask.js";
import { getGenerateTxTask } from "./subtasks/getGenerateTxTask.js";
import { getCreateGithubReleaseTask } from "./subtasks/getCreateGithubReleaseTask.js";
import { getVerifyEthConnectionTask } from "./subtasks/getVerifyEthConnectionTask.js";
import { getSetupContextTask } from "./subtasks/getSetupContextTask.js";

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
    getSetupContextTask({ rootDir: dir }), // TODO: Pass the variants here once multi-variant package publish is implemented
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
