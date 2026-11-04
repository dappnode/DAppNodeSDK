import path from "path";
import { defaultVariantsDirName } from "../../../params.js";
import { getAllVariantsInPath } from "../../../files/variants/getAllPackageVariants.js";
import { fetchPinsGroupedByBranch } from "../../../pinStrategy/index.js";
import { cliArgsToReleaseUploaderProvider } from "../../../releaseUploader/index.js";
import { Github } from "../../../providers/github/Github.js";
import { PinataPinManager } from "../../../providers/pinata/pinManager.js";
import { readManifest } from "../../../files/index.js";

/**
 * Removes all pins associated with a branch that no longer exists
 */
export async function cleanPinsFromDeletedBranches({
  dir,
  variantsDirName = defaultVariantsDirName
}: {
  dir: string;
  variantsDirName?: string;
}): Promise<void> {
  // Read manifest from disk to get package name
  const { manifest } = readManifest([{ dir }]);

  const variantsPath = path.join(dir, variantsDirName);
  const manifests = manifest.name
    ? [manifest]
    : getAllVariantsInPath(variantsPath).map(
        variant =>
          readManifest([{ dir }, { dir: path.join(variantsPath, variant) }])
            .manifest
      );
  if (manifests.some(item => !item.name))
    throw new Error("Cannot clean pins without a package name");

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

  for (const manifest of manifests) {
    const pinsGroupedByBranch = await fetchPinsGroupedByBranch(
      pinata,
      manifest
    );
    for (const { branch, pins } of pinsGroupedByBranch) {
      if (branches.find(b => b.name === branch)) continue;
      // A branch may have been created after the list was fetched. Fail closed.
      if (await github.branchExists(branch)) continue;

      // Branch not found, delete all associated pins
      for (const pin of pins) {
        console.log(`Unpin ${pin.commit} ${pin.ipfsHash}`);
        await pinata.unpin(pin.ipfsHash).catch(e => {
          // Don't prevent unpinning other pins if one is faulty
          console.error(`Error on unpin ${pin.ipfsHash}`, e);
        });
      }
    }
  }
}
