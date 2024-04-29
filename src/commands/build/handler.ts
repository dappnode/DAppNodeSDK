import path from "path";
import chalk from "chalk";
import Listr from "listr";
import { BuildAndUploadOptions, buildAndUpload } from "../../tasks/buildAndUpload.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { defaultComposeFileName, defaultDir, defaultVariantsDir } from "../../params.js";
import { BuildCommandOptions, VerbosityOptions } from "./types.js";
import { getVariantNames } from "./variants.js";

export function buildHandler({
    provider: contentProvider,
    timeout: userTimeout,
    upload_to: uploadTo,
    skip_save: skipSave,
    skip_upload,
    require_git_data: requireGitData,
    delete_old_pins: deleteOldPins,
    all_variants: allVariants,
    variants_dir: variantsDir = defaultVariantsDir,
    variants,
    // Global options
    dir = defaultDir,
    compose_file_name: composeFileName = defaultComposeFileName,
    silent,
    verbose
}: BuildCommandOptions): Promise<ListrContextBuildAndPublish[]> {
    const skipUpload = skipSave || skip_upload;
    const multiVariantMode = Boolean(allVariants || (variants && variants?.length > 0));

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
        templateMode: multiVariantMode
    };

    const verbosityOptions: VerbosityOptions = { renderer: verbose ? "verbose" : silent ? "silent" : "default" }

    const buildTasks = multiVariantMode ?
        handleMultiVariantBuild({ buildOptions, variantsDir, variants, verbosityOptions }) :
        handleSinglePkgBuild({ buildOptions, verbosityOptions });

    return Promise.all(buildTasks.map((task) => task.run()));
}

function handleMultiVariantBuild({
    buildOptions,
    variantsDir,
    variants,
    verbosityOptions
}: {
    buildOptions: BuildAndUploadOptions;
    variantsDir: string;
    variants?: string;
    verbosityOptions: VerbosityOptions;
}
): Listr<ListrContextBuildAndPublish>[] {
    const variantsDirPath = path.join(buildOptions.dir, variantsDir);
    const variantNames = getVariantNames({ variantsDirPath, variants });

    if (variantNames.length === 0)
        throw new Error(`No valid variants specified. They must be included in: ${variantsDirPath}`);

    console.log(`${chalk.dim(`Building package from template for variant(s) ${variants}...`)}`);

    return variantNames.map((variantName) => new Listr(
        buildAndUpload({ ...buildOptions, variantName, variantsDirPath }),
        verbosityOptions
    ));
}

function handleSinglePkgBuild({
    buildOptions,
    verbosityOptions
}: {
    buildOptions: BuildAndUploadOptions;
    verbosityOptions: VerbosityOptions;
}): Listr<ListrContextBuildAndPublish>[] {
    console.log(`${chalk.dim(`Building single package...`)}`);

    return [new Listr(
        buildAndUpload(buildOptions),
        verbosityOptions
    )];
}