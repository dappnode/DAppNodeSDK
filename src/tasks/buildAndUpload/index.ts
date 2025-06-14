import { ListrTask } from "listr/index.js";
import { defaultVariantsDirName } from "../../params.js";
import { ListrContextBuild } from "../../types.js";
import { parseTimeout } from "../../utils/timeout.js";
import {
  getReleaseUploader,
  cliArgsToReleaseUploaderProvider
} from "../../releaseUploader/index.js";
import { BuildAndUploadOptions } from "./types.js";
import { getVerifyConnectionTask } from "./getVerifyConnectionTask.js";
import { getReleaseDirCreationTask } from "./getReleaseDirCreationTask.js";
import { getFileValidationTask } from "./getFileValidationTask.js";
import { getFileCopyTask } from "./getFileCopyTask.js";
import { getBuildTasks } from "./getBuildTasks.js";
import { getUploadTasks } from "./getUploadTasks.js";
import { getDeleteOldPinsTask } from "./getDeleteOldPinsTask.js";
import { getSaveUploadResultsTask } from "./getSaveUploadResultsTask.js";

export function buildAndUpload({
  contentProvider,
  uploadTo,
  userTimeout,
  skipSave,
  skipUpload,
  requireGitData,
  deleteOldPins,
  composeFileName,
  dir,
  variantsDirPath = defaultVariantsDirName,
  packagesToBuildProps
}: BuildAndUploadOptions): ListrTask<ListrContextBuild>[] {
  const buildTimeout = parseTimeout(userTimeout);

  // Release upload. Use function for return syntax
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo,
    contentProvider
  });
  const releaseUploader = getReleaseUploader(releaseUploaderProvider);

  return [
    getFileValidationTask({ packagesToBuildProps }),
    getVerifyConnectionTask({ releaseUploader, skipUpload }),
    getReleaseDirCreationTask({ packagesToBuildProps }),
    getFileCopyTask({
      packagesToBuildProps,
      variantsDirPath,
      rootDir: dir,
      composeFileName,
      requireGitData
    }),
    ...getBuildTasks({
      packagesToBuildProps,
      buildTimeout,
      skipSave,
      rootDir: dir
    }),
    ...getUploadTasks({
      packagesToBuildProps,
      releaseUploader,
      requireGitData: !!requireGitData,
      composeFileName,
      skipUpload
    }),
    getDeleteOldPinsTask({
      packagesToBuildProps,
      deleteOldPins: !!deleteOldPins,
      releaseUploaderProvider
    }),
    getSaveUploadResultsTask({
      packagesToBuildProps,
      rootDir: dir,
      contentProvider,
      variantsDirPath,
      skipUpload
    })
  ];
}
