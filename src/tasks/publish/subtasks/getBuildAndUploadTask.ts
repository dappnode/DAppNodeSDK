import Listr, { ListrTask } from "listr";
import { BuildAndUploadOptions } from "../../buildAndUpload/types.js";
import { ListrContextPublish } from "../../../types.js";
import { buildAndUpload } from "../../buildAndUpload/index.js";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { merge } from "lodash-es";

export function getBuildAndUploadTask({
  buildOptions,
  verbosityOptions
}: {
  buildOptions: BuildAndUploadOptions;
  verbosityOptions: VerbosityOptions;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Building and uploading",
    task: async ctx => {
      const buildTasks = new Listr(
        buildAndUpload(buildOptions),
        verbosityOptions
      );

      const buildResults = await buildTasks.run();

      // Add build results to publish context
      ctx = merge(ctx, buildResults);
    }
  };
}
