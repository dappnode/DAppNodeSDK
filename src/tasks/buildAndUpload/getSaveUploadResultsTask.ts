import { ListrTask } from "listr/index.js";
import { addReleaseRecord } from "../../utils/releaseRecord.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { pruneCache } from "../../utils/cache.js";
import { VariantsMap } from "./types.js";

export function getSaveUploadResultsTask({ variantsMap, rootDir, contentProvider }: { variantsMap: VariantsMap, rootDir: string, contentProvider: string }): ListrTask<ListrContextBuildAndPublish> {
    return {
        title: "Save upload results",
        task: async ctx => {

            // TODO: Do not assume only one variant
            const [, { manifest: { name, version } }] = Object.entries(variantsMap)[0];

            addReleaseRecord({
                dir: rootDir,
                version,
                hash: ctx[name].releaseHash,
                to: contentProvider
            });

            try {
                await pruneCache();
            } catch (e) {
                console.error("Error on pruneCache", e);
            }
        }
    };
}