import path from "path";
import { ListrTask } from "listr/index.js";
import { verifyAvatar } from "../../utils/verifyAvatar.js";
import { copyReleaseFile } from "../../utils/copyReleaseFile.js";
import { releaseFilesDefaultNames } from "../../params.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { getGitHeadIfAvailable } from "../../utils/git.js";
import { writeManifest } from "../../files/index.js";
import { Manifest, releaseFiles } from "@dappnode/types";
import { VariantsMap, VariantsMapEntry } from "./types.js";
import { writeReleaseCompose } from "./utils.js";

export function getFileCopyTask({
  variantsMap,
  rootDir,
  composeFileName,
  requireGitData
}: {
  variantsMap: VariantsMap;
  rootDir: string;
  composeFileName: string;
  requireGitData?: boolean;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Copy files to release directory",
    task: async () =>
      copyFilesToReleaseDir({
        variantsMap,
        rootDir,
        composeFileName,
        requireGitData
      })
  };
}

async function copyFilesToReleaseDir({
  variantsMap,
  rootDir,
  composeFileName,
  requireGitData
}: {
  variantsMap: VariantsMap;
  rootDir: string;
  composeFileName: string;
  requireGitData?: boolean;
}): Promise<void> {
  for (const [, variant] of Object.entries(variantsMap)) {
    await copyVariantFilesToReleaseDir({ variant, rootDir, composeFileName });

    // Verify avatar (throws)
    const avatarPath = path.join(
      variant.releaseDir,
      releaseFilesDefaultNames.avatar
    );
    verifyAvatar(avatarPath);

    // Make sure git data is available before doing a long build
    await getGitHeadIfAvailable({ requireGitData });
  }
}

async function copyVariantFilesToReleaseDir({
  variant,
  rootDir,
  composeFileName
}: {
  variant: VariantsMapEntry;
  rootDir: string;
  composeFileName: string;
}): Promise<void> {
  const { manifest, manifestFormat, releaseDir, compose } = variant;

  for (const [fileId, fileConfig] of Object.entries(releaseFiles)) {
    switch (fileId as keyof typeof releaseFiles) {
      case "manifest":
        writeManifest<Manifest>(manifest, manifestFormat, { dir: releaseDir });
        break;

      case "compose":
        writeReleaseCompose({ compose, composeFileName, manifest, releaseDir });
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
