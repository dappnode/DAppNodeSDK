import { ListrTask } from "listr/index.js";
import { addReleaseRecord } from "../../utils/releaseRecord.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { pruneCache } from "../../utils/cache.js";
import path from "path";

export function getSaveUploadResultsTask({
  packagesToBuildProps,
  rootDir,
  variantsDirPath,
  contentProvider,
  skipUpload,
}: {
  packagesToBuildProps: PackageToBuildProps[];
  rootDir: string;
  variantsDirPath: string;
  contentProvider: string;
  skipUpload?: boolean;
}): ListrTask<ListrContextBuild> {
  return {
    title: "Save upload results",
    skip: () => skipUpload,
    task: async ctx => {

      for (const { variant, manifest: { name, version } } of packagesToBuildProps) {
        const { releaseMultiHash: hash } = ctx[name];

        if (!hash) continue;

        addReleaseRecord({
          dir: variant ? path.join(variantsDirPath, variant) : rootDir,
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
