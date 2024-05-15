import path from "path";
import Listr, { ListrTask } from "listr/index.js";
import { ListrContextBuild } from "../../types.js";
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
}): ListrTask<ListrContextBuild>[] {
  const buildTasks: ListrTask<ListrContextBuild>[] = Object.entries(
    variantsMap
  ).flatMap(([, variantSpecs]) => {
    return variantSpecs.architectures.map(architecture =>
      createBuildTask({
        variantSpecs,
        architecture,
        buildTimeout,
        skipSave,
        rootDir
      })
    );
  });

  return buildTasks;
}

function createBuildTask({
  variantSpecs,
  architecture,
  buildTimeout,
  skipSave,
  rootDir
}: {
  variantSpecs: VariantsMapEntry;
  architecture: Architecture;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask {
  const { manifest, releaseDir, images, compose } = variantSpecs;
  const { name, version } = manifest;
  const buildFn =
    architecture === defaultArch ? buildWithCompose : buildWithBuildx;

  const destPath = getImagePath({
    releaseDir,
    name,
    version,
    architecture
  });

  return {
    title: `Build ${name} (version ${version}) for arch ${architecture}`,
    task: () =>
      new Listr(
        buildFn({
          architecture,
          images,
          compose,
          manifest,
          buildTimeout,
          skipSave,
          destPath,
          rootDir
        })
      )
  };
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
