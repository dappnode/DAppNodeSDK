import { ListrTask } from "listr/index.js";
import { addReleaseRecord } from "../../utils/releaseRecord.js";
import { BuildVariantsMap, ListrContextBuild } from "../../types.js";
import { pruneCache } from "../../utils/cache.js";
import path from "path";

export function getSaveUploadResultsTask({
  variantsMap,
  rootDir,
  variantsDirPath,
  contentProvider,
  skipUpload,
  isMultiVariant
}: {
  variantsMap: BuildVariantsMap;
  rootDir: string;
  variantsDirPath: string;
  contentProvider: string;
  skipUpload?: boolean;
  isMultiVariant?: boolean;
}): ListrTask<ListrContextBuild> {
  return {
    title: "Save upload results",
    skip: () => skipUpload,
    task: async ctx => {

      for (const [variant, { manifest: { name, version } }] of Object.entries(variantsMap)) {
        const { releaseMultiHash: hash } = ctx[name];

        if (!hash) continue;

        addReleaseRecord({
          dir: isMultiVariant ? path.join(variantsDirPath, variant) : rootDir,
          version,
          hash,
          to: contentProvider
        });
      }

      try {
        await pruneCache();
      } catch (e) {
        console.error("Error on pruneCache", e);
      }
    }
  };
}
