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
      const releaseHashes = Object.entries(ctx).map(
        ([, { releaseMultiHash }]) => releaseMultiHash
      );

      if (releaseHashes.length < 1)
        throw new Error(
          "Could not get release hash from previous task while trying to generate the publish tx."
        );

      // TODO: Generate 1 tx per package
      const releaseMultiHash = releaseHashes[0];

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
