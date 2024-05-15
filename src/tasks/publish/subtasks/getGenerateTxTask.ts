import { ListrTask } from "listr";
import { VerbosityOptions } from "../../../commands/build/types.js";
import { ListrContextPublish } from "../../../types.js";
import { generatePublishTx } from "../../generatePublishTx/index.js";
import { readManifest } from "../../../files/index.js";

export function getGenerateTxTask({
  dir,
  composeFileName,
  developerAddress,
  ethProvider,
  verbosityOptions
}: {
  dir: string;
  composeFileName: string;
  developerAddress?: string;
  ethProvider: string;
  verbosityOptions: VerbosityOptions;
}): ListrTask<ListrContextPublish> {
  return {
    title: "Generate transaction",
    task: (ctx, task) => {
      // TODO: Generate 1 tx per package
      const [, { releaseMultiHash }] = Object.entries(ctx)[0];

      const { manifest } = readManifest([{ dir }]);

      if (releaseMultiHash) {
        return generatePublishTx({
          dir,
          compose_file_name: composeFileName,
          releaseMultiHash,
          developerAddress,
          ethProvider,
          verbosityOptions,
          manifest
        });
      } else {
        task.output = "No release hash found. Skipping transaction generation.";
      }
    }
  };
}
