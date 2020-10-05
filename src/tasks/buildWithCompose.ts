import { ListrTask } from "listr";
import { defaultArch, PackageImage } from "../types";
import { shell } from "../utils/shell";
import { saveAndCompressImagesCached } from "./saveAndCompressImages";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function buildWithCompose({
  images,
  composePath,
  destPath,
  buildTimeout,
  skipSave
}: {
  images: PackageImage[];
  composePath: string;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
}): ListrTask[] {
  return [
    {
      title: "Build docker image",
      task: async (_, task) => {
        // Prior to this task, the compose should had been updated with the proper tag
        await shell(`docker-compose --file ${composePath} build`, {
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
