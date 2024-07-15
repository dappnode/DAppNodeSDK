import path from "path";
import { ListrTask } from "listr";
import { BuildVariantsMap, ListrContextPublish } from "../../../types.js";
import {
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose,
  readManifest,
  getComposePackageImages
} from "../../../files/index.js";

export function getUpdateFilesTask({
  rootDir,
  variantsDirPath,
  composeFileName,
  variantsMap,
  isMultiVariant
}: {
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
  variantsMap: BuildVariantsMap;
  isMultiVariant: boolean;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Update compose and manifest files",
    task: async ctx => {
      for (const [variant, { manifest: { name }, composePaths, manifestPaths }] of Object.entries(variantsMap)) {
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
          isMultiVariant
        });

        const newCompose = readCompose(composePaths);
        const newManifest = readManifest(manifestPaths).manifest;

        // Update variantsMap entry
        variantsMap[variant].compose = newCompose;
        variantsMap[variant].manifest = newManifest;
        variantsMap[variant].images = getComposePackageImages(newCompose, newManifest);
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
  isMultiVariant
}: {
  rootDir: string;
  composeFileName: string;
  variant: string;
  variantsDirPath: string;
  dnpName: string;
  nextVersion: string;
  isMultiVariant: boolean;
}): void {
  // For multi-variant packages, manifest and compose files to be modified are located in the variant folder
  // Single variant packages have single-variant as the variant name
  const filesDir = isMultiVariant ? path.join(variantsDirPath, variant) : rootDir;

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