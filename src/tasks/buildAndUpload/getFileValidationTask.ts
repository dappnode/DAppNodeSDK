import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose,
  validateNotificationsSchema
} from "@dappnode/schemas";
import { getComposePath, readNotificationsIfExists, readSetupWizardIfExists } from "../../files/index.js";
import { CliError } from "../../params.js";

export function getFileValidationTask({
  packagesToBuildProps,
  rootDir
}: {
  packagesToBuildProps: PackageToBuildProps[];
  rootDir: string;
}): ListrTask<ListrContextBuild> {
  return {
    title: `Validate files`,
    task: async () => await validatePackageFiles({ packagesToBuildProps, rootDir })
  };
}

async function validatePackageFiles({
  packagesToBuildProps,
  rootDir
}: {
  packagesToBuildProps: PackageToBuildProps[];
  rootDir: string;
}): Promise<void> {
  const setupWizard = readSetupWizardIfExists(rootDir);
  if (setupWizard) validateSetupWizardSchema(setupWizard);

  const notifications = readNotificationsIfExists(rootDir);
  if (notifications) validateNotificationsSchema(notifications);

  for (const pkgProps of packagesToBuildProps)
    await validateVariantFiles(pkgProps);
}

async function validateVariantFiles(
  pkgProps: PackageToBuildProps
): Promise<void> {
  const { manifest, compose, composePaths } = pkgProps;

  console.log(
    `Validating files for ${manifest.name} (version ${manifest.version})`
  );

  // Validate manifest schema
  validateManifestSchema(manifest);

  validatePackageName(manifest.name);
  validatePackageVersion(manifest.version);

  // Validate compose file using docker compose
  await validateComposeSchema(composePaths.map(pathObj => getComposePath(pathObj)));

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
