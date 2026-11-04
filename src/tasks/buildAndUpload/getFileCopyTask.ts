import fs from "fs";
import yaml from "js-yaml";
import path from "path";
import { ListrTask } from "listr/index.js";
import { verifyAvatar } from "../../utils/verifyAvatar.js";
import { copyReleaseFile } from "../../utils/copyReleaseFile.js";
import {
  defaultComposeFileName,
  releaseFilesDefaultNames
} from "../../params.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { getGitHeadIfAvailable } from "../../utils/git.js";
import {
  updateComposeImageTags,
  writeCompose,
  writeManifest
} from "../../files/index.js";
import { Compose, Manifest, releaseFiles } from "@dappnode/types";

export function getFileCopyTask({
  packagesToBuildProps,
  variantsDirPath,
  rootDir,
  composeFileName,
  requireGitData
}: {
  packagesToBuildProps: PackageToBuildProps[];
  variantsDirPath: string;
  rootDir: string;
  composeFileName: string;
  requireGitData?: boolean;
}): ListrTask<ListrContextBuild> {
  return {
    title: "Copy files to release directory",
    task: async () =>
      copyFilesToReleaseDir({
        packagesToBuildProps,
        variantsDirPath,
        rootDir,
        composeFileName,
        requireGitData
      })
  };
}

async function copyFilesToReleaseDir({
  packagesToBuildProps,
  variantsDirPath,
  rootDir,
  composeFileName,
  requireGitData
}: {
  packagesToBuildProps: PackageToBuildProps[];
  variantsDirPath: string;
  rootDir: string;
  composeFileName: string;
  requireGitData?: boolean;
}): Promise<void> {
  for (const variantProps of packagesToBuildProps) {
    await copyVariantFilesToReleaseDir({
      variantProps,
      rootDir,
      variantsDirPath,
      composeFileName
    });

    // Verify avatar (throws)
    const avatarPath = path.join(
      variantProps.releaseDir,
      releaseFilesDefaultNames.avatar
    );
    verifyAvatar(avatarPath);

    // Make sure git data is available before doing a long build
    await getGitHeadIfAvailable({ requireGitData, dir: rootDir });
  }
}

async function copyVariantFilesToReleaseDir({
  variantProps,
  rootDir,
  variantsDirPath,
  composeFileName
}: {
  variantProps: PackageToBuildProps;
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
}): Promise<void> {
  const {
    manifest,
    manifestFormat,
    releaseDir,
    compose,
    variant,
    notifications,
    setupWizard
  } = variantProps;

  // In case of single variant packages, the targets are in the root dir
  const variantDirPath = variant
    ? path.join(variantsDirPath, variant)
    : rootDir;

  for (const [fileId, fileConfig] of Object.entries(releaseFiles)) {
    // For single variant packages, the targets are in the root dir
    const dirsToCopy = fs.existsSync(variantDirPath)
      ? [rootDir, variantDirPath]
      : [rootDir];

    switch (fileId as keyof typeof releaseFiles) {
      case "manifest":
        writeManifest<Manifest>(manifest, manifestFormat, { dir: releaseDir });
        break;

      case "compose":
        writeReleaseCompose({ compose, composeFileName, manifest, releaseDir });
        break;

      case "notifications":
        if (notifications)
          fs.writeFileSync(
            path.join(releaseDir, releaseFilesDefaultNames.notifications),
            yaml.dump(notifications)
          );
        break;

      case "setupWizard":
        if (setupWizard)
          fs.writeFileSync(
            path.join(releaseDir, releaseFilesDefaultNames.setupWizard),
            JSON.stringify(setupWizard, null, 2) + "\n"
          );
        break;

      case "prometheusTargets": {
        // Only one targets file per release: the variant's replaces the root's,
        // because scrape targets differ per variant (docs/dev/metrics.md).
        const sourceDir = [...new Set(dirsToCopy)]
          .filter(dir =>
            fs.readdirSync(dir).some(file => fileConfig.regex.test(file))
          )
          .pop();
        if (!sourceDir) break;
        const files = fs
          .readdirSync(sourceDir)
          .filter(file => fileConfig.regex.test(file));
        if (files.length > 1)
          throw new Error(
            `More than one prometheusTargets file found in ${sourceDir}: ${files.join(
              ", "
            )}. Only one file can match ${fileConfig.regex}`
          );
        // Normalise YAML sources so the released .json file is valid JSON.
        const targets = yaml.load(
          fs.readFileSync(path.join(sourceDir, files[0]), "utf8")
        );
        fs.writeFileSync(
          path.join(releaseDir, releaseFilesDefaultNames.prometheusTargets),
          JSON.stringify(targets, null, 2) + "\n"
        );
        break;
      }

      default: {
        const candidates = [...new Set(dirsToCopy)].filter(dir =>
          fs.readdirSync(dir).some(file => fileConfig.regex.test(file))
        );
        const sources = fileConfig.multiple
          ? candidates
          : [candidates.pop() || rootDir];
        for (const fromDir of sources)
          copyReleaseFile({
            fileConfig: { ...fileConfig, id: fileId },
            fromDir,
            toDir: releaseDir
          });
        break;
      }
    }
  }
}

function writeReleaseCompose({
  compose,
  composeFileName = defaultComposeFileName,
  manifest,
  releaseDir
}: {
  compose: Compose;
  composeFileName?: string;
  manifest: Manifest;
  releaseDir: string;
}): void {
  const releaseCompose = updateComposeImageTags(compose, manifest, {
    editExternalImages: true
  });
  writeCompose(releaseCompose, { dir: releaseDir, composeFileName });
}
