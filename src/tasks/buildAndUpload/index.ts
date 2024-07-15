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
    getFileValidationTask({ packagesToBuildProps: packagesToBuildProps, rootDir: dir }),
    getVerifyConnectionTask({ releaseUploader, skipUpload }),
    getReleaseDirCreationTask({ variantsMap: packagesToBuildProps }),
    getFileCopyTask({
      variantsMap: packagesToBuildProps,
      variantsDirPath,
      rootDir: dir,
      composeFileName,
      requireGitData
    }),
    ...getBuildTasks({ variantsMap: packagesToBuildProps, buildTimeout, skipSave, rootDir: dir }),
    ...getUploadTasks({
      variantsMap: packagesToBuildProps,
      releaseUploader,
      requireGitData: !!requireGitData,
      composeFileName,
      skipUpload
    }),
    getDeleteOldPinsTask({
      variantsMap: packagesToBuildProps,
      deleteOldPins: !!deleteOldPins,
      releaseUploaderProvider
    }),
    getSaveUploadResultsTask({
      variantsMap: packagesToBuildProps,
      rootDir: dir,
      contentProvider,
      variantsDirPath,
      skipUpload
    })
  ];
}
