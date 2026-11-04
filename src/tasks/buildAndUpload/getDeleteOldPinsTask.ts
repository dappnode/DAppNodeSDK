import { ListrTask } from "listr/index.js";
import { PackageToBuildProps, ListrContextBuild } from "../../types.js";
import { getGitHead } from "../../utils/git.js";
import { fetchPinsWithBranchToDelete } from "../../pinStrategy/index.js";
import { PinataPinManager } from "../../providers/pinata/pinManager.js";
import { ReleaseUploaderProvider } from "../../releaseUploader/index.js";

export function getDeleteOldPinsTask({
  packagesToBuildProps,
  deleteOldPins,
  releaseUploaderProvider
}: {
  packagesToBuildProps: PackageToBuildProps[];
  deleteOldPins: boolean;
  releaseUploaderProvider: ReleaseUploaderProvider;
}): ListrTask<ListrContextBuild> {
  return {
    title: "Delete old pins",
    enabled: () => deleteOldPins,
    skip: ctx =>
      !packagesToBuildProps.some(
        pkg => ctx[pkg.manifest.name]?.releaseMultiHash
      ),
    task: async (ctx, task) => {
      if (releaseUploaderProvider.type !== "pinata")
        throw Error("Must use pinata for deleteOldPins");

      // Unpin items on the same branch but previous (ancestor) commits
      const pinata = new PinataPinManager(releaseUploaderProvider);

      for (const { manifest, manifestPaths } of packagesToBuildProps) {
        // Never remove the previous release until its replacement was uploaded.
        if (!ctx[manifest.name]?.releaseMultiHash) continue;
        const gitHead = await getGitHead(manifestPaths[0]?.dir);
        const pinsToDelete = await fetchPinsWithBranchToDelete(
          pinata,
          manifest,
          gitHead,
          manifestPaths[0]?.dir
        );

        for (const pin of pinsToDelete) {
          if (
            pin.ipfsHash ===
            ctx[manifest.name].releaseMultiHash?.replace(/^\/ipfs\//, "")
          )
            continue;
          task.output = `Unpinning previous commit ${pin.commit} ${pin.ipfsHash}`;
          await pinata.unpin(pin.ipfsHash).catch(e => {
            console.error(`Error deleting old pin ${pin.ipfsHash}`, e);
          });
        }
      }
    }
  };
}
