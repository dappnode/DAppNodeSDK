import { ListrTask } from "listr";
import { PackageImage } from "../../types.js";
import { shell } from "../../utils/shell.js";
import { saveAndCompressImagesCached } from "../saveAndCompressImages.js";
import { Compose, Manifest, defaultArch } from "@dappnode/types";
import { tmpComposeFileName } from "../../params.js";
import path from "path";
import { writeTmpCompose } from "./writeTmpCompose.js";

/**
 * Save docker image
 * This step is extremely expensive computationally.
 * A local cache file will prevent unnecessary compressions if the image hasn't changed
 */
export function buildWithCompose({
  images,
  compose,
  manifest,
  destPath,
  buildTimeout,
  skipSave,
  rootDir
}: {
  images: PackageImage[];
  compose: Compose;
  manifest: Manifest;
  destPath: string;
  buildTimeout: number;
  skipSave?: boolean;
  rootDir: string;
}): ListrTask[] {
  const tmpComposePath = path.join(rootDir, tmpComposeFileName);

  // Write the compose to a temporary file
  writeTmpCompose({
    compose,
    composeFileName: tmpComposeFileName,
    manifest,
    rootDir
  });

  return [
    {
      title: "Build docker image",
      task: async (_, task) => {
        // Prior to this task, the compose should had been updated with the proper tag
        await shell(`docker-compose --file ${tmpComposePath} build`, {
          timeout: buildTimeout,
          maxBuffer: 100 * 1e6,
          onData: data => (task.output = data)
        });
      }
    },

    ...saveAndCompressImagesCached({
      images,
      architecture: defaultArch,
      destPath,
      buildTimeout,
      skipSave
    }),
    {
      title: "Cleanup temporary files",
      task: async () => shell(`rm ${tmpComposePath}`)
    }
  ];
}
