import { ListrTask } from "listr";
import { ListrContextPublish } from "../../../types.js";
import { readManifest } from "../../../files/index.js";

export function getSetupContextTask({
  rootDir
}: {
  rootDir: string;
}): ListrTask<ListrContextPublish> {
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
