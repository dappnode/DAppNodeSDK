import Listr from "listr";
import { Architecture, architectures } from "@dappnode/types";
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
  require_git_data: requireGitData,
  delete_old_pins: deleteOldPins,
  all_variants: allVariants,
  variants_dir_name: variantsDirName = defaultVariantsDirName,
  variants,
  skip_compose_validation: skipComposeValidation,
  strip_compose_version: stripComposeVersion,
  arch,
  // Global options
  dir = defaultDir,
  compose_file_name: composeFileName = defaultComposeFileName,
  silent,
  verbose
}: BuildCommandOptions): Promise<ListrContextBuild> {
  const skipUpload = skip_upload || skipSave;

  const variantsDirPath = path.join(dir, variantsDirName);

  const architecture = arch ? normalizeArchitecture(arch) : undefined;

  const packagesToBuildProps = getPackagesToBuildProps({
    allVariants: Boolean(allVariants),
    commaSeparatedVariants: variants,
    rootDir: dir,
    variantsDirPath,
    composeFileName
  });

  // Filter architectures if --arch flag is provided
  if (architecture) {
    for (const pkg of packagesToBuildProps) {
      if (!pkg.architectures.includes(architecture))
        throw Error(
          `Architecture '${architecture}' is not supported by package ${pkg.manifest.name}. Supported: ${pkg.architectures.join(", ")}`
        );
      pkg.architectures = [architecture];
    }
  }

  const buildOptions: BuildAndUploadOptions = {
    dir,
    contentProvider,
    uploadTo,
    userTimeout,
    skipSave,
    skipUpload,
    composeFileName,
    requireGitData,
    variantsDirPath,
    skipComposeValidation,
    stripComposeVersion,
    packagesToBuildProps
  };

  const verbosityOptions: VerbosityOptions = {
    renderer: verbose ? "verbose" : silent ? "silent" : "default"
  };

  const buildTasks = new Listr(buildAndUpload(buildOptions), verbosityOptions);

  return await buildTasks.run();
}

const archShorthands: Record<string, Architecture> = {
  amd64: "linux/amd64",
  x86_64: "linux/amd64",
  x64: "linux/amd64",
  arm64: "linux/arm64",
  aarch64: "linux/arm64",
  arm: "linux/arm64"
};

export function normalizeArchitecture(arch: string): Architecture {
  const normalized = archShorthands[arch] ?? arch;
  if (!architectures.includes(normalized as Architecture))
    throw Error(
      `Invalid architecture '${arch}', allowed values: ${architectures.join(", ")} (or shorthands: ${Object.keys(archShorthands).join(", ")})`
    );
  return normalized as Architecture;
}
