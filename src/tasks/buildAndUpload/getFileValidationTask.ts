import { ListrTask } from "listr/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose
} from "@dappnode/schemas";
import { readSetupWizardIfExists } from "../../files/index.js";
import { VariantsMap, VariantsMapEntry } from "./types.js";

export function getFileValidationTask({
  variantsMap,
  rootDir
}: {
  variantsMap: VariantsMap;
  rootDir: string;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: `Validate files`,
    task: async () => await validatePackageFiles({ variantsMap, rootDir })
  };
}

async function validatePackageFiles({
  variantsMap,
  rootDir
}: {
  variantsMap: VariantsMap;
  rootDir: string;
}): Promise<void> {
  const setupWizard = readSetupWizardIfExists(rootDir);

  if (setupWizard) validateSetupWizardSchema(setupWizard);

  for (const [, variant] of Object.entries(variantsMap))
    await validateVariantFiles(variant);
}

async function validateVariantFiles(variant: VariantsMapEntry): Promise<void> {
  const { manifest, compose, composePaths } = variant;

  console.log(
    `Validating files for ${manifest.name} (version ${manifest.version})`
  );

  // Validate manifest schema
  validateManifestSchema(manifest);

  // Validate compose file using docker compose
  await validateComposeSchema(composePaths);

  // Validate compose file specifically for Dappnode requirements
  validateDappnodeCompose(compose, manifest);
}
