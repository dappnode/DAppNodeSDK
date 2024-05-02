import { ListrTask } from "listr/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import {
    validateComposeSchema,
    validateManifestSchema,
    validateSetupWizardSchema,
    validateDappnodeCompose
} from "@dappnode/schemas";
import {
    readSetupWizardIfExists
} from "../../files/index.js";
import { VariantsMap, VariantsMapEntry } from "./types.js";

export function getFileValidationTask({ variantsMap, rootDir }: { variantsMap: VariantsMap, rootDir: string }): ListrTask<ListrContextBuildAndPublish> {

    return {
        title: `Validate files`,
        task: async () => await validatePackageFiles({ variantsMap, rootDir })
    };
}

async function validatePackageFiles({ variantsMap, rootDir }: { variantsMap: VariantsMap, rootDir: string }): Promise<void> {

    const setupWizard = readSetupWizardIfExists(rootDir);

    if (setupWizard)
        validateSetupWizardSchema(setupWizard);

    for (const [, variant] of Object.entries(variantsMap))
        await validateVariantFiles(variant);

}

async function validateVariantFiles(variant: VariantsMapEntry): Promise<void> {
    const {
        manifest,
        compose,
        rootComposePath,
        variantComposePath
    } = variant;

    console.log(`Validating files for ${manifest.name} (version ${manifest.version})`);

    // Include defined paths
    const composePaths = [rootComposePath, ...(variantComposePath ? [variantComposePath] : [])];

    // TODO: Check if the previous loop here can be removed
    // Validate manifest schema
    validateManifestSchema(manifest);

    // Validate all compose files
    await Promise.all(composePaths.map(path => validateComposeSchema([path])));
    validateDappnodeCompose(compose, manifest);
}