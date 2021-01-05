import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../types";
import { defaultDir } from "../../params";
import { fetchPinsWithBranch } from "../../pinStrategy";
import { cliArgsToReleaseUploaderProvider } from "../../releaseUploader";
import { PinataPinManager } from "../../releaseUploader/pinata";
import { readManifest } from "../../utils/manifest";
import {
  getGithubEventData,
  GithubActionsEventData
} from "../../providers/github/githubActions";

export const unpinOnRefDelete: CommandModule<
  CliGlobalOptions,
  CliGlobalOptions
> = {
  command: "unpin-on-ref-delete",
  describe: "Unpin all pin items associated with a deleted branch",
  builder: {},
  handler: async (args): Promise<void> => await unpinOnRefDeleteHandler(args)
};

/**
 * Common handler for CLI and programatic usage
 */
export async function unpinOnRefDeleteHandler({
  dir = defaultDir
}: CliGlobalOptions): Promise<void> {
  // Get info about the deleted branch
  const eventData = getGithubEventData<GithubActionsEventData["delete"]>();
  if (eventData.ref_type !== "branch") {
    console.log(`Only ref_type == 'branch' supported: '${eventData.ref_type}'`);
    return;
  }

  // Fetch Pinata credentials from ENVs
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo: "ipfs",
    contentProvider: "pinata"
  });
  if (releaseUploaderProvider.type !== "pinata")
    throw Error("Must use pinata for deletePins");
  const pinata = new PinataPinManager(releaseUploaderProvider);

  // Read manifest from disk to get package name
  const manifest = readManifest(dir);

  const branch = eventData.ref; // "dapplion/branch-to-delete"
  const gitHead = { branch };

  console.log(`Unpin items with deleted branch ${branch}`);

  const pins = await fetchPinsWithBranch(pinata, manifest, gitHead);

  for (const pin of pins) {
    console.log(`Unpin ${pin.commit} ${pin.ipfsHash}`);
    await pinata.unpin(pin.ipfsHash);
  }
}
