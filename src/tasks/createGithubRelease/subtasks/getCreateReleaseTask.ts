import path from "path";
import fs from "fs";
import { Github } from "../../../providers/github/Github.js";
import {
  ListrContextPublish,
  TxData,
  contentHashFile
} from "../../../types.js";
import { ListrTask } from "listr";
import {
  compactManifestIfCore,
  composeDeleteBuildProperties
} from "../../../files/index.js";
import {
  getInstallDnpLink,
  getPublishTxLink
} from "../../../utils/getLinks.js";
import { getNextGitTag } from "./getNextGitTag.js";

/**
 * Create release
 *  nextVersion comes from the first task in `publish`
 *  buildDir comes from the first task in `publish`
 */
export function getCreateReleaseTask({
  github,
  buildDir,
  releaseMultiHash,
  composeFileName
}: {
  github: Github;
  buildDir: string;
  releaseMultiHash: string;
  composeFileName?: string;
}): ListrTask<ListrContextPublish> {
  return {
    title: `Create release`,
    task: async (ctx, task) => {
      // TODO: Do this for each release
      const [, { nextVersion, txData }] = Object.entries(ctx)[0];

      const tag = getNextGitTag(nextVersion);

      task.output = "Deleting existing release...";
      await github.deleteReleaseAndAssets(tag);

      const contentHashPath = writeContentHashToFile({
        buildDir,
        releaseMultiHash
      });

      compactManifestIfCore(buildDir);

      composeDeleteBuildProperties({ dir: buildDir, composeFileName });

      if (txData) {
        task.output = `Creating release for tag ${tag}...`;
        await github.createReleaseAndUploadAssets(tag, {
          body: getReleaseBody(txData),
          prerelease: true, // Until it is actually published to mainnet
          assetsDir: buildDir,
          ignorePattern: /\.tar\.xz$/ // To ignore legacy .tar.xz image
        });
      }

      // Clean content hash file so the directory uploaded to IPFS is the same
      // as the local build_* dir. User can then `ipfs add -r` and get the same hash
      fs.unlinkSync(contentHashPath);
    }
  };
}

/**
 * Plain text file which should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 */
function writeContentHashToFile({
  buildDir,
  releaseMultiHash
}: {
  buildDir: string;
  releaseMultiHash: string;
}): string {
  const contentHashPath = path.join(buildDir, contentHashFile);
  fs.writeFileSync(contentHashPath, releaseMultiHash);
  return contentHashPath;
}

/**
 * Write the release body
 *
 * TODO: Extend this to automatically write the body of the changelog
 */
function getReleaseBody(txData: TxData) {
  const link = getPublishTxLink(txData);
  const changelog = "";
  const installLink = getInstallDnpLink(txData.releaseMultiHash);
  return `
  ##### Changelog
  
  ${changelog}
  
  ---
  
  ##### For package mantainer
  
  Authorized developer account may execute this transaction [from a pre-filled link](${link})[.](${installLink})
  
  <details><summary>Release details</summary>
  <p>
  
  \`\`\`
  To: ${txData.to}
  Value: ${txData.value}
  Data: ${txData.data}
  Gas limit: ${txData.gasLimit}
  \`\`\`
  
  \`\`\`
  ${txData.releaseMultiHash}
  \`\`\`
  
  </p>
  </details>
  
  `.trim();
}
