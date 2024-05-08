import { ListrTask } from "listr/index.js";
import { defaultVariantsDirName } from "../../params.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { parseTimeout } from "../../utils/timeout.js";
import {
  getReleaseUploader,
  cliArgsToReleaseUploaderProvider
} from "../../releaseUploader/index.js";
import { BuildAndUploadOptions } from "./types.js";
import { buildVariantMap } from "./buildVariantMap.js";
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
  variants
}: BuildAndUploadOptions): ListrTask<ListrContextBuildAndPublish>[] {
  const buildTimeout = parseTimeout(userTimeout);

  // Release upload. Use function for return syntax
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo,
    contentProvider
  });
  const releaseUploader = getReleaseUploader(releaseUploaderProvider);

  const variantsMap = buildVariantMap({
    variants,
    rootDir: dir,
    variantsDirPath,
    composeFileName
  });

  return [
    getFileValidationTask({ variantsMap, rootDir: dir }),
    getVerifyConnectionTask({ releaseUploader, skipUpload }),
    getReleaseDirCreationTask({ variantsMap }),
    getFileCopyTask({
      variantsMap,
      rootDir: dir,
      composeFileName,
      requireGitData
    }),
    ...getBuildTasks({ variantsMap, buildTimeout, skipSave, rootDir: dir }),
    ...getUploadTasks({
      variantsMap,
      releaseUploader,
      requireGitData: !!requireGitData,
      composeFileName,
      skipUpload
    }),
    getDeleteOldPinsTask({
      variantsMap,
      deleteOldPins: !!deleteOldPins,
      releaseUploaderProvider
    }),
    getSaveUploadResultsTask({
      variantsMap,
      rootDir: dir,
      contentProvider,
      variantsDirPath,
      skipUpload
    })
  ];
}
