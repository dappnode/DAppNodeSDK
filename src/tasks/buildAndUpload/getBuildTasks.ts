import path from "path";
import Listr, { ListrTask } from "listr/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { buildWithBuildx } from "./buildWithBuildx.js";
import { buildWithCompose } from "./buildWithCompose.js";
import { Architecture, defaultArch } from "@dappnode/types";
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
  skipSave,
  rootDir
}: {
  variantsMap: VariantsMap;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask<ListrContextBuildAndPublish>[] {
  const buildTasks: ListrTask<ListrContextBuildAndPublish>[] = [];

  for (const [, variantSpecs] of Object.entries(variantsMap)) {
    const {
      manifest: { name, version },
      architectures
    } = variantSpecs;

    if (architectures.length === 1 && architectures[0] === defaultArch) {
      buildTasks.push({
        title: `Build ${name} (version ${version})`,
        task: () =>
          new Listr(
            buildVariantWithCompose({
              variantSpecs,
              buildTimeout,
              skipSave,
              rootDir
            })
          )
      });
    } else {
      buildTasks.push(
        ...architectures.map(architecture => ({
          title: `Build ${name} (version ${version}) for arch ${architecture}`,
          task: () =>
            new Listr(
              buildVariantWithBuildx({
                variantSpecs,
                architecture,
                buildTimeout,
                skipSave,
                rootDir
              })
            )
        }))
      );
    }
  }

  return buildTasks;
}

function buildVariantWithBuildx({
  architecture,
  variantSpecs,
  buildTimeout,
  skipSave,
  rootDir
}: {
  architecture: Architecture;
  variantSpecs: VariantsMapEntry;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask[] {
  const { manifest, images, compose, releaseDir } = variantSpecs;

  const destPath = getImagePath({
    releaseDir,
    name: manifest.name,
    version: manifest.version,
    architecture
  });

  return buildWithBuildx({
    architecture,
    images,
    compose,
    manifest,
    buildTimeout,
    skipSave,
    destPath,
    rootDir
  });
}

function buildVariantWithCompose({
  variantSpecs,
  buildTimeout,
  skipSave,
  rootDir
}: {
  variantSpecs: VariantsMapEntry;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask[] {
  const { images, compose, manifest, releaseDir } = variantSpecs;
  const destPath = getImagePath({
    releaseDir,
    name: manifest.name,
    version: manifest.version
  });

  return buildWithCompose({
    images,
    compose,
    manifest,
    buildTimeout,
    skipSave,
    destPath,
    rootDir
  });
}

function getImagePath({
  releaseDir,
  name,
  version,
  architecture = defaultArch
}: {
  releaseDir: string;
  name: string;
  version: string;
  architecture?: Architecture;
}): string {
  return path.join(releaseDir, getImageFileName(name, version, architecture));
}
