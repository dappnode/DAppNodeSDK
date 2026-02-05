import Listr from "listr";
import path from "path";
import {
  defaultComposeFileName,
  defaultDir,
  defaultVariantsDirName
} from "../../params.js";
import { ListrContextPublish } from "../../types.js";
import { VerbosityOptions } from "../build/types.js";
import { PublishCommandOptions } from "./types.js";
import { publish } from "../../tasks/publish/index.js";
import { parseReleaseType } from "./parseReleaseType.js";
import { getPackagesToBuildProps } from "../build/variants.js";

/**
 * Common handler for CLI and programatic usage
 */
export async function publishHandler({
  type,
  provider,
  eth_provider,
  content_provider,
  developer_address: developerAddress = process.env.DEVELOPER_ADDRESS,
  timeout: userTimeout,
  upload_to: uploadTo,
  github_release: githubRelease,
  dappnode_team_preset: dappnode_team_preset,
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  skip_compose_validation: skipComposeValidation,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose,
  variants_dir_name: variantsDirName = defaultVariantsDirName,
  all_variants: allVariants,
  variants
}: PublishCommandOptions): Promise<ListrContextPublish> {
  let ethProvider = provider || eth_provider;
  let contentProvider = provider || content_provider;

  const isCi = process.env.CI;

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  /**
   * Specific set of options used for internal DAppNode releases.
   * Caution: options may change without notice.
   */
  if (dappnode_team_preset) {
    if (isCi) {
      contentProvider = "https://api.ipfs.dappnode.io";
      uploadTo = "ipfs";
      verbose = true;
    }
    ethProvider = "remote";
    githubRelease = true;
  }

  const releaseType = parseReleaseType({ type });

  const variantsDirPath = path.join(dir, variantsDirName);

  const isMultiVariant = !!allVariants || !!variants;

  const publishTasks = new Listr(
    publish({
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
      skipComposeValidation,
      packagesToBuildProps: getPackagesToBuildProps({
        allVariants: Boolean(allVariants),
        commaSeparatedVariants: variants,
        rootDir: dir,
        variantsDirPath,
        composeFileName
      }),
      isMultiVariant
    }),
    verbosityOptions
  );

  return await publishTasks.run();
}
