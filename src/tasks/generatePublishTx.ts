import Listr from "listr";
import { readManifest } from "../utils/manifest";
import { getPublishTxLink } from "../utils/getLinks";
import { addReleaseTx } from "../utils/releaseRecord";
import { defaultDir } from "../params";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types";
import { getPM } from "../providers/pm";

/**
 * Generates the transaction data necessary to publish the package.
 * It will check if the repository exists first:
 * - If it exists:
 * - If it does not exists:
 *
 * Then it will construct the txData object = {to, value, data, gasLimit} and:
 * - Write it on deploy.txt
 * - Show it on screen
 */

export function generatePublishTx({
  dir = defaultDir,
  releaseMultiHash,
  developerAddress,
  ethProvider,
  verbose,
  silent
}: {
  releaseMultiHash: string;
  developerAddress?: string;
  ethProvider: string;
} & CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  return new Listr<ListrContextBuildAndPublish>(
    [
      {
        title: "Generate transaction",
        task: async ctx => {
          // Load manifest ##### Verify manifest object
          const { manifest } = readManifest({ dir });
          const dnpName = manifest.name;
          const version = manifest.version;

          const pm = getPM(ethProvider);
          const txSummary = await pm.populatePublishTransaction({
            dnpName: manifest.name,
            version: manifest.version,
            releaseMultiHash,
            developerAddress
          });

          const txPublishLink = getPublishTxLink({
            dnpName,
            version,
            releaseMultiHash,
            developerAddress
          });

          // Write Tx data in a file for future reference
          addReleaseTx({ dir, version, link: txPublishLink });

          ctx.txData = txSummary;
          ctx.txPublishLink = txPublishLink;
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}
