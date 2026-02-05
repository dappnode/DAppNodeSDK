import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose,
  validateNotificationsSchema
} from "@dappnode/schemas";
import { getComposePath } from "../../files/index.js";
import { CliError } from "../../params.js";

export function getFileValidationTask({
  packagesToBuildProps,
  skipComposeValidation
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
}): ListrTask<ListrContextBuild> {
  return {
    title: `Validate files`,
    task: async () =>
      await validatePackageFiles({
        packagesToBuildProps,
        skipComposeValidation
      })
  };
}

async function validatePackageFiles({
  packagesToBuildProps,
  skipComposeValidation
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
}): Promise<void> {
  for (const pkgProps of packagesToBuildProps)
    await validateVariantFiles(pkgProps, skipComposeValidation);
}

async function validateVariantFiles(
  pkgProps: PackageToBuildProps,
  skipComposeValidation?: boolean
): Promise<void> {
  const {
    manifest,
    compose,
    composePaths,
    notifications,
    setupWizard
  } = pkgProps;

  console.log(
    `Validating files for ${manifest.name} (version ${manifest.version})`
  );

  // Validate manifest schema
  validateManifestSchema(manifest);

  validatePackageName(manifest.name);
  validatePackageVersion(manifest.version);

  // Validate compose file using docker compose
  await validateComposeSchema(
    composePaths.map(pathObj => getComposePath(pathObj))
  );

  // Validate compose file specifically for Dappnode requirements
  if (skipComposeValidation) {
    console.log(`Skipping Dappnode compose validation for ${manifest.name}`);
  } else {
    validateDappnodeCompose(compose, manifest);
  }

  // Validate notifications schema
  if (notifications) validateNotificationsSchema(notifications);

  // Validate setup wizard schema
  if (setupWizard) validateSetupWizardSchema(setupWizard);
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
