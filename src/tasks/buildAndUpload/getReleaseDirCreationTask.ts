import fs from "fs";
import path from "path";
import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { getImageFileName } from "../../utils/getImageFileName.js";

export function getReleaseDirCreationTask({
  packagesToBuildProps
}: {
  packagesToBuildProps: PackageToBuildProps[];
}): ListrTask<ListrContextBuild> {
  return {
    title: `Create release directories`,
    task: ctx => createReleaseDirs({ ctx, packagesToBuildProps })
  };
}

function createReleaseDirs({
  ctx,
  packagesToBuildProps
}: {
  ctx: ListrContextBuild;
  packagesToBuildProps: PackageToBuildProps[];
}): void {
  for (const {
    variant,
    manifest: { name, version },
    releaseDir,
    architectures
  } of packagesToBuildProps) {
    fs.mkdirSync(releaseDir, { recursive: true }); // Ok on existing dir
    const releaseFiles = fs.readdirSync(releaseDir);

    ctx[name] = { ...ctx[name], variant, releaseDir };

    const imagePaths = architectures.map(arch =>
      getImageFileName(name, version, arch)
    );

    // Clean all files except the expected target images
    for (const filepath of releaseFiles)
      if (!imagePaths.includes(filepath))
        fs.rmSync(path.join(releaseDir, filepath), {
          recursive: true,
          force: true
        });
  }
}
