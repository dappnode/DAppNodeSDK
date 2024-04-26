import { ListrTask } from "listr";
import { PackageImage } from "../types.js";
import { shell } from "../utils/shell.js";
import { saveAndCompressImagesCached } from "./saveAndCompressImages.js";
import { defaultArch } from "@dappnode/types";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function buildWithCompose({
  images,
  composePath,
  variantComposePath,
  destPath,
  buildTimeout,
  skipSave
}: {
  images: PackageImage[];
  composePath: string;
  variantComposePath?: string;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
}): ListrTask[] {
  return [
    {
      title: "Build docker image",
      task: async (_, task) => {
        // Prior to this task, the compose should had been updated with the proper tag
        await shell(`docker-compose --file ${composePath} ${variantComposePath ? `--file ${variantComposePath} ` : ""}build`, {
          timeout: buildTimeout,
          maxBuffer: 100 * 1e6,
          onData: data => (task.output = data)
        });
      }
    },

    ...saveAndCompressImagesCached({
      images,
      architecture: defaultArch,
      destPath,
      buildTimeout,
      skipSave
    })
  ];
}