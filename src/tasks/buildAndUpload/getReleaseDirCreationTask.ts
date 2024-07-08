import fs from "fs";
import path from "path";
import { ListrTask } from "listr/index.js";
import rimraf from "rimraf";
import { BuildVariantsMap, ListrContextBuild } from "../../types.js";
import { getImageFileName } from "../../utils/getImageFileName.js";

export function getReleaseDirCreationTask({
  variantsMap
}: {
  variantsMap: BuildVariantsMap;
}): ListrTask<ListrContextBuild> {
  return {
    title: `Create release directories`,
    task: ctx => createReleaseDirs({ ctx, variantsMap })
  };
}

function createReleaseDirs({
  ctx,
  variantsMap
}: {
  ctx: ListrContextBuild;
  variantsMap: BuildVariantsMap;
}): void {
  for (const [
    variant,
    {
      manifest: { name, version },
      releaseDir,
      architectures
    }
  ] of Object.entries(variantsMap)) {
    console.log(
      `Creating release directory for ${name} (version ${version}) at ${releaseDir}`
    );

    fs.mkdirSync(releaseDir, { recursive: true }); // Ok on existing dir
    const releaseFiles = fs.readdirSync(releaseDir);

    ctx[name] = ctx[name] || { variant };
    ctx[name].releaseDir = releaseDir;

    const imagePaths = architectures.map(arch =>
      getImageFileName(name, version, arch)
    );

    // Clean all files except the expected target images
    for (const filepath of releaseFiles)
      if (!imagePaths.includes(filepath))
        rimraf.sync(path.join(releaseDir, filepath));
  }
}
