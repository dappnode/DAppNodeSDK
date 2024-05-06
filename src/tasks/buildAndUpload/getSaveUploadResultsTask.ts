import { ListrTask } from "listr/index.js";
import { addReleaseRecord } from "../../utils/releaseRecord.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { pruneCache } from "../../utils/cache.js";
import { VariantsMap } from "./types.js";
import path from "path";

export function getSaveUploadResultsTask({
  variantsMap,
  rootDir,
  variantsDirPath,
  contentProvider,
  skipUpload
}: {
  variantsMap: VariantsMap;
  rootDir: string;
  variantsDirPath: string;
  contentProvider: string;
  skipUpload?: boolean
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Save upload results",
    skip: () => skipUpload,
    task: async ctx => {
      // Single package
      if (variantsMap.default) {
        const { name, version } = variantsMap.default.manifest;
        const { releaseHash: hash } = ctx[name];

        addReleaseRecord({
          dir: rootDir,
          version,
          hash,
          to: contentProvider
        });

        // Multi-variant package
      } else {
        for (const [
          variant,
          {
            manifest: { name, version }
          }
        ] of Object.entries(variantsMap)) {
          const variantDir = path.join(variantsDirPath, variant);
          const { releaseHash: hash } = ctx[name];

          addReleaseRecord({
            dir: variantDir,
            version: version,
            hash,
            to: contentProvider
          });
        }
      }

      try {
        await pruneCache();
      } catch (e) {
        console.error("Error on pruneCache", e);
      }
    }
  };
}
