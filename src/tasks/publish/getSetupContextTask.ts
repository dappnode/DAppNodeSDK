import { ListrTask } from "listr";
import { ListrContextBuildAndPublish } from "../../types";
import { readManifest } from "../../files/index.js";

export function getSetupContextTask({
  rootDir
}: {
  rootDir: string;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Setting up publish context",
    task: ctx => {
      const {
        manifest: { name }
      } = readManifest([{ dir: rootDir }]);

      ctx[name] = { variant: "default" };
    }
  };
}
