import Listr from "listr";
import { buildAndUpload } from "../../tasks/buildAndUpload/index.js";
import { ListrContextBuild } from "../../types.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultVariantsDirName
} from "../../params.js";
import { BuildCommandOptions, VerbosityOptions } from "./types.js";
import { getPackagesToBuildProps } from "./variants.js";
import { BuildAndUploadOptions } from "../../tasks/buildAndUpload/types.js";
import path from "path";

export async function buildHandler({
  provider: contentProvider,
  timeout: userTimeout,
  upload_to: uploadTo,
  skip_save: skipSave,
  skip_upload,
  sign_release: signReleaseFlag,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  all_variants: allVariants,
  variants_dir_name: variantsDirName = defaultVariantsDirName,
  variants,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: BuildCommandOptions): Promise<ListrContextBuild> {
  const skipUpload = skip_upload || skipSave;

  const variantsDirPath = path.join(dir, variantsDirName);

  const buildOptions: BuildAndUploadOptions = {
    dir,
    contentProvider,
    uploadTo,
    userTimeout,
    skipSave,
    skipUpload,
    signReleaseFlag: signReleaseFlag ?? false,
    composeFileName,
    requireGitData,
    deleteOldPins,
    variantsDirPath,
    packagesToBuildProps: getPackagesToBuildProps({
      allVariants: Boolean(allVariants),
      commaSeparatedVariants: variants,
      rootDir: dir,
      variantsDirPath,
      composeFileName
    })
  };

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  const buildTasks = new Listr(buildAndUpload(buildOptions), verbosityOptions);

  return await buildTasks.run();
}
