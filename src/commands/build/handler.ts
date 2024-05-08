import path from "path";
import chalk from "chalk";
import Listr from "listr";
import { buildAndUpload } from "../../tasks/buildAndUpload/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import {
  defaultComposeFileName,
  defaultDir,
  defaultVariantsDirName
} from "../../params.js";
import { BuildCommandOptions, VerbosityOptions } from "./types.js";
import { getValidVariantNames } from "./variants.js";
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
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: BuildCommandOptions): Promise<ListrContextBuildAndPublish> {
  const skipUpload = skip_upload || skipSave;

  const multiVariantMode = Boolean(
    allVariants || (variants && variants?.length > 0)
  );

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
    ...(multiVariantMode &&
      getVariantOptions({
        variantsStr: variants,
        rootDir: dir,
        variantsDirName
      }))
  };

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  const buildTasks = new Listr(buildAndUpload(buildOptions), verbosityOptions);

  return await buildTasks.run();
}

function getVariantOptions({
  variantsStr,
  rootDir,
  variantsDirName
}: {
  variantsStr: string | undefined;
  rootDir: string;
  variantsDirName: string;
}): { variants: string[]; variantsDirPath: string } {
  const variantsDirPath = path.join(rootDir, variantsDirName);
  const variantNames = getValidVariantNames({
    variantsDirPath,
    variants: variantsStr
  });

  if (variantNames.length === 0)
    throw new Error(
      `No valid variants specified. They must be included in: ${variantsDirPath}`
    );

  console.log(
    `${chalk.dim(
      `Building package from template for variant(s) ${variantsStr}...`
    )}`
  );

  return { variants: variantNames, variantsDirPath };
}
