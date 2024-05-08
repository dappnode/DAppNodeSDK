import { ListrTask } from "listr/index.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { getGitHead } from "../../utils/git.js";
import { fetchPinsWithBranchToDelete } from "../../pinStrategy/index.js";
import { PinataPinManager } from "../../providers/pinata/pinManager.js";
import { ReleaseUploaderProvider } from "../../releaseUploader/index.js";
import { VariantsMap } from "./types.js";

export function getDeleteOldPinsTask({
  variantsMap,
  deleteOldPins,
  releaseUploaderProvider
}: {
  variantsMap: VariantsMap;
  deleteOldPins: boolean;
  releaseUploaderProvider: ReleaseUploaderProvider;
}): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Delete old pins",
    enabled: () => deleteOldPins,
    task: async (_, task) => {
      const gitHead = await getGitHead();
      if (releaseUploaderProvider.type !== "pinata")
        throw Error("Must use pinata for deleteOldPins");

      // Unpin items on the same branch but previous (ancestor) commits
      const pinata = new PinataPinManager(releaseUploaderProvider);

      for (const [, { manifest }] of Object.entries(variantsMap)) {
        const pinsToDelete = await fetchPinsWithBranchToDelete(
          pinata,
          manifest,
          gitHead
        );

        for (const pin of pinsToDelete) {
          task.output = `Unpinning previous commit ${pin.commit} ${pin.ipfsHash}`;
          await pinata.unpin(pin.ipfsHash).catch(e => {
            console.error(`Error deleting old pin ${pin.ipfsHash}`, e);
          });
        }
      }
    }
  };
}
