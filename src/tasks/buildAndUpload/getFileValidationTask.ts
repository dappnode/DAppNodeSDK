import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import {
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose,
  validateNotificationsSchema
} from "@dappnode/schemas";
import {
  getComposePath,
  stripComposeVersion as removeComposeVersion
} from "../../files/index.js";
import { cloneDeep } from "lodash-es";
import { CliError } from "../../params.js";
import { shell, ShellError } from "../../utils/shell.js";

export function getFileValidationTask({
  packagesToBuildProps,
  skipComposeValidation,
  stripComposeVersion
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
  stripComposeVersion?: boolean;
}): ListrTask<ListrContextBuild> {
  return {
    title: `Validate files`,
    task: async (ctx, task) => {
      const coercions = await validatePackageFiles({
        packagesToBuildProps,
        skipComposeValidation,
        stripComposeVersion,
        onStatus: message => {
          task.output = message;
        }
      });
      // Release files are written from the validated objects, so coerced values are
      // what ships. Keep the warning in the title so it stays visible after completion.
      if (coercions.length > 0)
        task.title = `Validate files (warning: schema validation changed ${
          coercions.length
        } value(s), fix the source files: ${coercions.slice(0, 5).join("; ")}${
          coercions.length > 5 ? "; ..." : ""
        })`;
    }
  };
}

async function validatePackageFiles({
  packagesToBuildProps,
  skipComposeValidation,
  stripComposeVersion,
  onStatus
}: {
  packagesToBuildProps: PackageToBuildProps[];
  skipComposeValidation?: boolean;
  stripComposeVersion?: boolean;
  onStatus: (message: string) => void;
}): Promise<string[]> {
  const coercions: string[] = [];
  for (const pkgProps of packagesToBuildProps) {
    onStatus(`Validating ${pkgProps.manifest.name}`);
    coercions.push(
      ...(await validateVariantFiles(
        pkgProps,
        skipComposeValidation,
        stripComposeVersion
      ))
    );
  }
  return coercions;
}

async function validateVariantFiles(
  pkgProps: PackageToBuildProps,
  skipComposeValidation?: boolean,
  stripComposeVersion?: boolean
): Promise<string[]> {
  const { manifest, compose, composePaths, notifications, setupWizard } =
    pkgProps;
  const coercions: string[] = [];
  const label = (file: string) => `${manifest.name} ${file}`;

  // Validate manifest schema
  coercions.push(
    ...validateReportingCoercions(
      label("manifest"),
      manifest,
      validateManifestSchema
    )
  );

  validatePackageName(manifest.name);
  validatePackageVersion(manifest.version);

  // Validate compose file using docker compose
  try {
    await shell([
      "docker",
      "compose",
      ...composePaths.flatMap(spec => ["-f", getComposePath(spec)]),
      "config",
      "--quiet"
    ]);
  } catch (e) {
    if (!(e instanceof ShellError)) throw e;
    throw new CliError(`Invalid compose:\n${e.stderr.trim() || e.message}`);
  }

  // Validate compose file specifically for Dappnode requirements
  if (!skipComposeValidation) {
    validateDappnodeCompose(compose, manifest);
  }

  // Validate notifications schema
  if (notifications)
    coercions.push(
      ...validateReportingCoercions(
        label("notifications"),
        notifications,
        validateNotificationsSchema
      )
    );
  if (setupWizard)
    coercions.push(
      ...validateReportingCoercions(
        label("setup-wizard"),
        setupWizard,
        validateSetupWizardSchema
      )
    );

  // Keep version available for the Dappnode validation above. Stripping is
  // opt-in while support for versionless Compose files is being tested.
  if (stripComposeVersion) removeComposeVersion(compose);
  return coercions;
}

/**
 * The schemas validate with type coercion, which mutates the object in place.
 * Returns a description of every value the validator changed.
 */
export function validateReportingCoercions<T>(
  label: string,
  value: T,
  validate: (value: T) => unknown
): string[] {
  const before = cloneDeep(value);
  validate(value);
  return changedPaths(before, value).map(change => `${label} ${change}`);
}

function changedPaths(before: unknown, after: unknown, at = ""): string[] {
  if (
    before !== null &&
    after !== null &&
    typeof before === "object" &&
    typeof after === "object"
  ) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return [...keys].flatMap(key =>
      changedPaths(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        at ? `${at}.${key}` : key
      )
    );
  }
  return Object.is(before, after)
    ? []
    : [
        `${at || "(root)"}: ${JSON.stringify(before)} -> ${JSON.stringify(
          after
        )}`
      ];
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
