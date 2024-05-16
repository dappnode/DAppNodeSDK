import Listr from "listr";
import { buildAndUpload } from "../../tasks/buildAndUpload/index.js";
import { ListrContextBuild } from "../../types.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultVariantsDirName
} from "../../params.js";
import { BuildCommandOptions, VerbosityOptions } from "./types.js";
import { getVariantOptions } from "./variants.js";
import { BuildAndUploadOptions } from "../../tasks/buildAndUpload/types.js";

export async function buildHandler({
  provider: contentProvider,
  timeout: userTimeout,
  upload_to: uploadTo,
  skip_save: skipSave,
  skip_upload,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  all_variants: allVariants,
  variants_dir_name: variantsDirName = defaultVariantsDirName,
  variants,
  // Global options
  rootDir: dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: BuildCommandOptions): Promise<ListrContextBuild> {
  const skipUpload = skip_upload || skipSave;

  const buildOptions: BuildAndUploadOptions = {
    dir,
    contentProvider,
    uploadTo,
    userTimeout,
    skipSave,
    skipUpload,
    composeFileName,
    requireGitData,
    deleteOldPins,
    ...getVariantOptions({
      allVariants: Boolean(allVariants),
      variantsStr: variants,
      rootDir: dir,
      variantsDirName,
      composeFileName
    })
  };

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  const buildTasks = new Listr(buildAndUpload(buildOptions), verbosityOptions);

  return await buildTasks.run();
}
