import path from "path";
import Listr, { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { buildWithBuildx } from "./buildWithBuildx.js";
import { buildWithCompose } from "./buildWithCompose.js";
import { Architecture, defaultArch } from "@dappnode/types";
import { getImageFileName } from "../../utils/getImageFileName.js";
import { getOsArchitecture } from "../../utils/getArchitecture.js";

/**
 * The naming scheme for multiarch exported images must be
 * compatible with DAppNodes that expect a single ".tar.xz" file
 * which must be amd64, x86_64
 *
 * const imageEntry = files.find(file => /\.tar\.xz$/.test(file));
 */
export function getBuildTasks({
  packagesToBuildProps,
  buildTimeout,
  skipSave,
  rootDir
}: {
  packagesToBuildProps: PackageToBuildProps[];
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask<ListrContextBuild>[] {
  const buildTasks: ListrTask<ListrContextBuild>[] = packagesToBuildProps.flatMap((pkgProps) => {
    return pkgProps.architectures.map(architecture =>
      createBuildTask({
        pkgProps,
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
  pkgProps,
  architecture,
  buildTimeout,
  skipSave,
  rootDir
}: {
  pkgProps: PackageToBuildProps;
  architecture: Architecture;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask<ListrContextBuild> {
  const { manifest, releaseDir, images, compose } = pkgProps;
  const { name, version } = manifest;
  const buildFn =
    architecture === getOsArchitecture() ? buildWithCompose : buildWithBuildx;

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
