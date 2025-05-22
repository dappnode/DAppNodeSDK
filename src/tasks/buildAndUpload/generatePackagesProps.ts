import path from "path";
import { parseArchitectures } from "../../utils/parseArchitectures.js";
import {
  readCompose,
  getComposePackageImages,
  parseComposeUpstreamVersion,
  readManifest,
  readNotificationsIfExists,
  readSetupWizardIfExists
} from "../../files/index.js";
import { Compose, Manifest } from "@dappnode/types";
import { defaultComposeFileName } from "../../params.js";
import { PackageToBuildProps } from "../../types.js";

export function generatePackagesProps({
  variants,
  rootDir,
  variantsDirPath,
  composeFileName = defaultComposeFileName
}: {
  variants: string[] | null;
  rootDir: string;
  variantsDirPath: string;
  composeFileName?: string;
}): PackageToBuildProps[] {
  if (variants === null)
    return [
      createPackagePropsItem({
        rootDir,
        composeFileName,
        variant: null,
        variantsDirPath
      })
    ];

  return variants.map(variant =>
    createPackagePropsItem({
      rootDir,
      composeFileName,
      variant,
      variantsDirPath
    })
  );
}

function createPackagePropsItem({
  rootDir,
  composeFileName,
  variant,
  variantsDirPath
}: {
  rootDir: string;
  composeFileName: string;
  variant: string | null;
  variantsDirPath: string;
}): PackageToBuildProps {
  const manifestPaths = [{ dir: rootDir }];
  const composePaths = [{ dir: rootDir, composeFileName }];
  const notificationsPaths = [{ dir: rootDir }];
  const setupWizardPaths = [{ dir: rootDir }];

  if (variant) {
    const variantPath = path.join(variantsDirPath, variant);

    manifestPaths.push({ dir: variantPath });
    composePaths.push({ dir: variantPath, composeFileName });
    notificationsPaths.push({ dir: variantPath });
    setupWizardPaths.push({ dir: variantPath });
  }

  const { manifest, format: manifestFormat } = readManifest(manifestPaths);
  const compose = readCompose(composePaths);
  const notifications = readNotificationsIfExists(notificationsPaths);
  const setupWizard = readSetupWizardIfExists(setupWizardPaths);

  const { name: dnpName, version } = manifest;

  // TODO: Handle upstream object defined case
  if (!manifest.upstream)
    manifest.upstreamVersion = getUpstreamVersion({ compose, manifest });

  return {
    variant,
    manifest,
    manifestFormat,
    compose,
    notifications,
    setupWizard,
    releaseDir: getReleaseDirPath({ rootDir, dnpName, version }),
    manifestPaths,
    composePaths,
    notificationsPaths,
    setupWizardPaths,
    images: getComposePackageImages(compose, manifest),
    architectures: parseArchitectures({
      rawArchs: manifest.architectures
    })
  };
}

function getUpstreamVersion({
  compose,
  manifest
}: {
  compose: Compose;
  manifest: Manifest;
}): string | undefined {
  return (
    parseComposeUpstreamVersion(compose) ||
    process.env.UPSTREAM_VERSION ||
    manifest.upstreamVersion
  );
}

function getReleaseDirPath({
  rootDir,
  dnpName,
  version
}: {
  rootDir: string;
  dnpName: string;
  version: string;
}): string {
  return path.join(rootDir, `build_${dnpName}_${version}`);
}
