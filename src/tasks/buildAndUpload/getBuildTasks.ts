import path from "path";
import { ListrTask } from "listr/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { buildWithBuildx } from "./buildWithBuildx.js";
import { buildWithCompose } from "./buildWithCompose.js";
import { Architecture } from "@dappnode/types";
import { getImageFileName } from "../../utils/getImageFileName.js";
import { VariantsMap, VariantsMapEntry } from "./types.js";

/**
 * The naming scheme for multiarch exported images must be
 * compatible with DAppNodes that expect a single ".tar.xz" file
 * which must be amd64, x86_64
 *
 * const imageEntry = files.find(file => /\.tar\.xz$/.test(file));
 */
export function getBuildTasks({
  variantsMap,
  buildTimeout,
  skipSave
}: {
  variantsMap: VariantsMap;
  buildTimeout: number;
  skipSave?: boolean;
}): ListrTask<ListrContextBuildAndPublish>[] {
  const buildTasks: ListrTask<ListrContextBuildAndPublish>[] = [];

  for (const [, variantSpecs] of Object.entries(variantsMap)) {
    const {
      manifest: { name, version },
      architectures
    } = variantSpecs;

    if (architectures) {
      buildTasks.push(
        ...architectures.map(architecture => ({
          title: `Build ${name} (version ${version}) for arch ${architecture}`,
          task: () =>
            buildVariantWithBuildx({
              variantSpecs,
              architecture,
              buildTimeout,
              skipSave
            })
        }))
      );
    } else {
      buildTasks.push({
        title: `Build ${name} (version ${version})`,
        task: () =>
          buildVariantWithCompose({ variantSpecs, buildTimeout, skipSave })
      });
    }
  }

  return buildTasks;
}

function buildVariantWithBuildx({
  architecture,
  variantSpecs,
  buildTimeout,
  skipSave
}: {
  architecture: Architecture;
  variantSpecs: VariantsMapEntry;
  buildTimeout: number;
  skipSave?: boolean;
}): void {
  const {
    manifest: { name, version },
    images,
    composePaths,
    releaseDir
  } = variantSpecs;

  const destPath = getImagePath({ releaseDir, name, version, architecture });

  buildWithBuildx({
    architecture,
    images,
    composePaths,
    buildTimeout,
    skipSave,
    destPath
  });
}

function buildVariantWithCompose({
  variantSpecs,
  buildTimeout,
  skipSave
}: {
  variantSpecs: VariantsMapEntry;
  buildTimeout: number;
  skipSave?: boolean;
}): void {
  const {
    manifest: { version, name },
    images,
    composePaths,
    releaseDir
  } = variantSpecs;
  const destPath = getImagePath({ releaseDir, name, version });

  buildWithCompose({
    images,
    composePaths,
    buildTimeout,
    skipSave,
    destPath
  });
}

function getImagePath({
  releaseDir,
  name,
  version,
  architecture = "linux/amd64"
}: {
  releaseDir: string;
  name: string;
  version: string;
  architecture?: Architecture;
}): string {
  return path.join(releaseDir, getImageFileName(name, version, architecture));
}
