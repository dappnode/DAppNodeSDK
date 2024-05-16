import Listr, { ListrTask } from "listr";
import { BuildAndUploadOptions } from "../../buildAndUpload/types.js";
import { ListrContextBuild, ListrContextPublish } from "../../../types.js";
import { buildAndUpload } from "../../buildAndUpload/index.js";
import { VerbosityOptions } from "../../../commands/build/types.js";

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

      copyBuildCtxToPublishCtx({
        buildCtx: buildResults,
        publishCtx: ctx
      });
    }
  };
}

function copyBuildCtxToPublishCtx({
  buildCtx,
  publishCtx
}: {
  buildCtx: ListrContextBuild;
  publishCtx: ListrContextPublish;
}) {
  for (const [key, result] of Object.entries(buildCtx)) {
    publishCtx[key] = publishCtx[key]
      ? { ...publishCtx[key], ...result }
      : result;
  }
}
