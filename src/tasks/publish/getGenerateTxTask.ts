import { ListrTask } from "listr";
import { VerbosityOptions } from "../../commands/build/types.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { generatePublishTx } from "../generatePublishTx.js";

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
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Generate transaction",
    task: (ctx, task) => {
      // TODO: Generate 1 tx per package
      const [, { releaseMultiHash }] = Object.entries(ctx)[0];

      if (releaseMultiHash) {
        generatePublishTx({
          dir,
          compose_file_name: composeFileName,
          releaseMultiHash,
          developerAddress,
          ethProvider,
          verbosityOptions
        });
      } else {
        // TODO: Check if this is the correct way to handle this case
        task.output = "No release hash found. Skipping transaction generation.";
      }
    }
  };
}
