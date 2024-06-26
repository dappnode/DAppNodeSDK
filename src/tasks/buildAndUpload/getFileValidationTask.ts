import { ListrTask } from "listr/index.js";
import { ListrContextBuild } from "../../types.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose
} from "@dappnode/schemas";
import { readSetupWizardIfExists } from "../../files/index.js";
import { VariantsMap, BuildVariantsMapEntry } from "./types.js";
import { CliError } from "../../params.js";

export function getFileValidationTask({
  variantsMap,
  rootDir
}: {
  variantsMap: VariantsMap;
  rootDir: string;
}): ListrTask<ListrContextBuild> {
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

async function validateVariantFiles(
  variant: BuildVariantsMapEntry
): Promise<void> {
  const { manifest, compose, composePaths } = variant;

  console.log(
    `Validating files for ${manifest.name} (version ${manifest.version})`
  );

  // Validate manifest schema
  validateManifestSchema(manifest);

  validatePackageName(manifest.name);
  validatePackageVersion(manifest.version);

  // Validate compose file using docker compose
  await validateComposeSchema(composePaths);

  // Validate compose file specifically for Dappnode requirements
  validateDappnodeCompose(compose, manifest);
}

function validatePackageName(name: string): void {
  if (/[A-Z]/.test(name))
    throw new CliError(
      `Package name (${name}) in the manifest must be lowercase`
    );
}

function validatePackageVersion(version: string): void {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new CliError(
      `Version in the manifest (${version}) must follow Semantic Versioning (SemVer) format (x.x.x)`
    );
  }
}
