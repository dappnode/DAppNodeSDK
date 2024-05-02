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
import { releaseFiles } from "@dappnode/types";
import { VariantsMap } from "./types.js";

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

    for (const [, { manifest, compose, rootComposePath: composePath, variantComposePath }] of Object.entries(variantsMap)) {

        console.log(`Validating files for ${manifest.name} (version ${manifest.version})`);

        const composePaths = [composePath, ...(variantComposePath ? [variantComposePath] : [])];

        for (const [fileId] of Object.entries(releaseFiles)) {
            switch (fileId as keyof typeof releaseFiles) {
                case "manifest":
                    validateManifestSchema(manifest);
                    break;
                case "compose":
                    // validate against official docker compose schema.
                    await validateComposeSchema(composePaths);

                    // validate against custom dappnode requirements
                    validateDappnodeCompose(compose, manifest);
                    break;
            }
        }
    }
}