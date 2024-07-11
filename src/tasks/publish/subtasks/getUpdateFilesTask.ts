import path from "path";
import { ListrTask } from "listr";
import { BuildVariantsMap, ListrContextPublish } from "../../../types.js";
import {
  writeManifest,
  readCompose,
  updateComposeImageTags,
  writeCompose,
  readManifest
} from "../../../files/index.js";
import { singleVariantName } from "../../../params.js";

export function getUpdateFilesTask({
  rootDir,
  variantsDirPath,
  composeFileName,
  variantsMap
}: {
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
  variantsMap: BuildVariantsMap;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Update compose and manifest files",
    task: async ctx => {
      for (const [variant, { manifest: { name } }] of Object.entries(variantsMap)) {
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
          nextVersion
        });

        updateVariantEntry({
          variant,
          rootDir,
          variantsDirPath,
          composeFileName,
          variantsMap
        });
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
  nextVersion
}: {
  rootDir: string;
  composeFileName: string;
  variant: string;
  variantsDirPath: string;
  dnpName: string;
  nextVersion: string;
}): void {
  // For multi-variant packages, manifest and compose files to be modified are located in the variant folder
  // Single variant packages have single-variant as the variant name
  const filesDir = variant === singleVariantName ? rootDir : path.join(variantsDirPath, variant);

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

// TODO: Test without exporting
export function updateVariantEntry({
  variant,
  rootDir,
  variantsDirPath,
  composeFileName,
  variantsMap
}: {
  variant: string;
  rootDir: string;
  variantsDirPath: string;
  composeFileName: string;
  variantsMap: BuildVariantsMap;
}) {
  if (variant === singleVariantName) {

    variantsMap[variant].manifest = readManifest([{ dir: rootDir }]).manifest;
    variantsMap[variant].compose = readCompose([{ dir: rootDir, composeFileName }]);

  } else {

    const variantPath = path.join(variantsDirPath, variant);
    variantsMap[variant].manifest = readManifest([{ dir: rootDir }, { dir: variantPath }]).manifest;
    variantsMap[variant].compose = readCompose([{ dir: rootDir, composeFileName }, { dir: variantPath, composeFileName }]);
  }
}