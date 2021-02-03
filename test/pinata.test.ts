import { PinataPinManager } from "../src/providers/pinata/pinManager";
import { fetchPinsWithBranchToDelete } from "../src/pinStrategy";
import { cliArgsToReleaseUploaderProvider } from "../src/releaseUploader";
import { Manifest } from "../src/types";
import { GitHead } from "../src/utils/git";

// Test used to locally debug Pinata issues
describe.skip("Pinata pin management", () => {
  it("Find pins to delete", async () => {
    const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
      uploadTo: "ipfs",
      contentProvider: "pinata"
    });

    if (releaseUploaderProvider.type !== "pinata")
      throw Error("Must use pinata for deleteOldPins");

    const manifest: Manifest = {
      name: "dappmanager.dnp.dappnode.eth",
      version: "0.2.39"
    };

    const gitHead: GitHead = {
      commit: "000000000000000000",
      branch: "pablo/upnp-view"
    };

    const pinata = new PinataPinManager(releaseUploaderProvider);
    const pinsToDelete = await fetchPinsWithBranchToDelete(
      pinata,
      manifest,
      gitHead
    );

    console.log(pinsToDelete);
  });
});
