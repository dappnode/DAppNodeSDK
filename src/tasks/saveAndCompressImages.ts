import { ListrTask } from "listr";
import { getFileHash } from "../utils/getFileHash";
import { loadCache, writeCache, getCacheKey } from "../utils/cache";
import { shell } from "../utils/shell";
import { compressFile } from "../utils/commands/compressFile";
import { ListrContextBuildAndPublish } from "../types";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function saveAndCompressImages({
  imageTags,
  destPath,
  buildTimeout
}: {
  imageTags: string[];
  destPath: string;
  buildTimeout: number;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Save and compress image",
    task: async (_, task) => {
      // Get a deterministic cache key for this collection of images
      const cacheKey = await getCacheKey(imageTags);

      // Load the cache object, and compute the target .tar.xz hash
      const cacheTarHash = loadCache().get(cacheKey);
      const tarHash = await getFileHash(destPath);
      if (tarHash && tarHash === cacheTarHash) {
        task.skip(`Using cached verified tarball ${destPath}`);
      } else {
        task.output = `Saving docker image to file...`;
        const destPathUncomp = `${destPath}.temp`;
        await shell(`docker save ${imageTags.join(" ")} > ${destPathUncomp}`);

        await compressFile(destPathUncomp, {
          timeout: buildTimeout,
          onData: msg => (task.output = msg)
        });

        task.output = `Storing saved image to cache...`;
        const newTarHash = await getFileHash(destPath);
        if (newTarHash) writeCache({ key: cacheKey, value: newTarHash });
      }
    }
  };
}
