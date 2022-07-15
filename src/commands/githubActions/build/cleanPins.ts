import {
  fetchPinsGroupedByBranch,
  fetchPinsOlderThan
} from "../../../pinStrategy";
import { cliArgsToReleaseUploaderProvider } from "../../../releaseUploader";
import { Github } from "../../../providers/github/Github";
import { PinataPinManager } from "../../../providers/pinata/pinManager";
import { readManifest } from "../../../files";

/**
 * Remove pins in the following conditions:
 * - pins associated with a branch that no longer exists
 * - pins older than a month
 */
export async function cleanPins({ dir }: { dir: string }): Promise<void> {
  // Read manifest from disk to get package name
  const { manifest } = readManifest({ dir });

  // Connect to Github Octokit REST API to know existing branches
  const github = Github.fromLocal(dir);
  const branches = await github.listBranches();

  // Fetch Pinata credentials from ENVs
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo: "ipfs",
    contentProvider: "pinata"
  });
  if (releaseUploaderProvider.type !== "pinata")
    throw Error("Must use pinata for deletePins");
  const pinata = new PinataPinManager(releaseUploaderProvider);

  // CLEAN PINS FROM DELETED BRANCHES
  const pinsGroupedByBranch = await fetchPinsGroupedByBranch(pinata, manifest);
  for (const { branch, pins } of pinsGroupedByBranch) {
    if (branches.find(b => b.name === branch)) continue;

    // Branch not found, delete all associated pins
    for (const pin of pins) {
      console.log(`Unpin ${pin.commit} ${pin.ipfsHash}`);
      await pinata.unpin(pin.ipfsHash).catch(e => {
        // Don't prevent unpinning other pins if one is faulty
        console.error(`Error on unpin ${pin.ipfsHash}`, e);
      });
    }
  }

  // CLEAN OLD PINS (>30 days) NOT RELEASED
  const pinsOlderThan = await fetchPinsOlderThan(pinata, manifest, 30);
  for (const pin of pinsOlderThan) {
    console.log(`Unpin ${pin.commit} ${pin.ipfsHash}`);
    await pinata.unpin(pin.ipfsHash).catch(e => {
      // Don't prevent unpinning other pins if one is faulty
      console.error(`Error on unpin ${pin.ipfsHash}`, e);
    });
  }
}
