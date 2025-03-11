import fs from "fs";
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

    await copyVariantFilesToReleaseDir({ variantProps, rootDir, variantsDirPath, composeFileName });

    // Verify avatar (throws)
    const avatarPath = path.join(
      variantProps.releaseDir,
      releaseFilesDefaultNames.avatar
    );
    verifyAvatar(avatarPath);

    // Make sure git data is available before doing a long build
    await getGitHeadIfAvailable({ requireGitData });
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
  const { manifest, manifestFormat, releaseDir, compose, variant } = variantProps;

  // In case of single variant packages, the targets are in the root dir
  const variantDirPath = variant ? path.join(variantsDirPath, variant) : rootDir;

  for (const [fileId, fileConfig] of Object.entries(releaseFiles)) {
    // For single variant packages, the targets are in the root dir
    const dirsToCopy = fs.existsSync(variantDirPath) ? [rootDir, variantDirPath] : [rootDir];

    switch (fileId as keyof typeof releaseFiles) {
      case "manifest":
        writeManifest<Manifest>(manifest, manifestFormat, { dir: releaseDir });
        break;

      case "compose":
        writeReleaseCompose({ compose, composeFileName, manifest, releaseDir });
        break;

      case "prometheusTargets":
        // Copy the targets in root and in the variant dir
        for (const dir of dirsToCopy) {
          copyReleaseFile({
            fileConfig: { ...fileConfig, id: fileId },
            fromDir: dir,
            toDir: releaseDir
          });
        }
        break;

      case "notifications":
        // Copy the notifications in root and in the variant dir
        for (const dir of dirsToCopy) {
          copyReleaseFile({
            fileConfig: { ...fileConfig, id: fileId },
            fromDir: dir,
            toDir: releaseDir
          });
        }
        break;

      default:
        copyReleaseFile({
          fileConfig: { ...fileConfig, id: fileId },
          fromDir: rootDir,
          toDir: releaseDir
        });
        break;
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
