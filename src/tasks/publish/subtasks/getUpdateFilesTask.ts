import path from "path";
import { ListrTask } from "listr";
import { PackageToBuildProps, ListrContextPublish } from "../../../types.js";
import {
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose,
  readManifest
} from "../../../files/index.js";

export function getUpdateFilesTask({
  rootDir,
  variantsDirPath,
  composeFileName,
  packagesToBuildProps,
}: {
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
  packagesToBuildProps: PackageToBuildProps[];
}): ListrTask<ListrContextPublish> {
  return {
    title: "Update compose and manifest files",
    task: async ctx => {
      for (const pkgProps of packagesToBuildProps) {
        const { variant, manifest: { name }, composePaths, manifestPaths } = pkgProps;
        const nextVersion = ctx[name].nextVersion;

        if (!nextVersion) {
          throw new Error(
            `No next version found for ${name}. It should have been fetched from APM.`
          );
        }

        updateVariantFiles({
          rootDir,
          composeFileName,
          variant,
          variantsDirPath,
          dnpName: name,
          nextVersion,
        });

        // Update variantsMap entry
        pkgProps.compose = readCompose(composePaths);
        pkgProps.manifest = readManifest(manifestPaths).manifest;
      }
    }
  };
}

// TODO: Test without exporting
export function updateVariantFiles({
  rootDir,
  composeFileName,
  variant,
  variantsDirPath,
  dnpName,
  nextVersion,
}: {
  rootDir: string;
  composeFileName: string;
  variant: string | null;
  variantsDirPath: string;
  dnpName: string;
  nextVersion: string;
}): void {
  // For multi-variant packages, manifest and compose files to be modified are located in the variant folder
  // Single variant packages have their files in the root dir
  const filesDir = variant ? path.join(variantsDirPath, variant) : rootDir;

  updateManifestFileVersion({
    manifestDir: filesDir,
    nextVersion
  });

  updateComposeFileImages({
    composeDir: filesDir,
    composeFileName,
    nextVersion,
    dnpName
  });
}

function updateManifestFileVersion({
  manifestDir,
  nextVersion
}: {
  manifestDir: string;
  nextVersion: string;
}) {
  const { manifest, format } = readManifest([{ dir: manifestDir }]);

  // Increase the version
  manifest.version = nextVersion;

  // Modify and write the manifest and docker-compose
  writeManifest(manifest, format, { dir: manifestDir });
}

function updateComposeFileImages({
  composeDir,
  composeFileName,
  nextVersion,
  dnpName
}: {
  composeDir: string;
  composeFileName: string;
  nextVersion: string;
  dnpName: string;
}) {
  const compose = readCompose([{ dir: composeDir, composeFileName }]);

  const newCompose = updateComposeImageTags(compose, {
    name: dnpName,
    version: nextVersion
  }, { editExternalImages: true });

  writeCompose(newCompose, {
    dir: composeDir,
    composeFileName
  });
}