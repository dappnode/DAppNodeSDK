import Listr, { ListrTask } from "listr";
import { BuildAndUploadOptions } from "../../buildAndUpload/types.js";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { ListrContextBuildAndPublish } from "../../../types.js";
import { buildAndUpload } from "../../buildAndUpload/index.js";

export function getBuildAndUploadTask({
  buildOptions,
  verbosityOptions
}: {
  buildOptions: BuildAndUploadOptions;
  verbosityOptions: VerbosityOptions;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Build and upload",
    task: () => new Listr(buildAndUpload(buildOptions), verbosityOptions)
  };
}
