import fs from "fs";
import path from "path";
import Listr from "listr";
import { getPublishTxLink, getInstallDnpLink } from "../utils/getLinks";
import { getGitHead } from "../utils/git";
import { compactManifestIfCore } from "../utils/compactManifest";
import { contentHashFile, defaultDir } from "../params";
import {
  TxData,
  CliGlobalOptions,
  ListrContextBuildAndPublish
} from "../types";
import { Github } from "../providers/github/Github";
import { composeDeleteBuildProperties } from "../utils/compose";

/**
 * Create (or edit) a Github release, then upload all assets
 */
export function createGithubRelease({
  dir = defaultDir,
  compose_file_name: composeFileName,
  buildDir,
  releaseMultiHash,
  verbose,
  silent
}: {
  buildDir: string;
  releaseMultiHash: string;
} & CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  // OAuth2 token from Github
  if (!process.env.GITHUB_TOKEN)
    throw Error("GITHUB_TOKEN ENV (OAuth2) is required");

  const github = Github.fromLocal(dir);

  const isCi = process.env.CI;
  const triggerTag = process.env.GITHUB_REF || process.env.TRAVIS_TAG;

  return new Listr<ListrContextBuildAndPublish>(
    [
      // 1. Handle tags
      // - If the release is triggered in CI,
      //   the trigger tag must be remove and replaced by the release tag
      // - If the release is triggered locally, the commit should be
      //   tagged and released on that tag
      {
        title: `Handle tags`,
        task: async (ctx, task) => {
          // Sanity check, make sure repo exists
          await github.assertRepoExists();

          // Get next version from context
          if (!ctx.nextVersion) throw Error("Missing ctx.nextVersion");
          const tag = `v${ctx.nextVersion}`;

          // If the release is triggered in CI,
          // the trigger tag must be removed ("release/patch")
          if (isCi && triggerTag && triggerTag.startsWith("release"))
            await github.deleteTagIfExists(triggerTag);

          // Check if the release tag exists remotely. If so, remove it
          await github.deleteTagIfExists(tag);

          // Get the commit sha to be tagged
          // - If on CI, use the current commit
          // - Otherwise use the current HEAD commit
          const currentCommitSha =
            process.env.GITHUB_SHA ||
            process.env.TRAVIS_COMMIT ||
            (await getGitHead()).commit;

          // Tag the current commit with the release tag
          task.output = `Releasing commit ${currentCommitSha} at tag ${tag}`;
          await github.createTag(tag, currentCommitSha);
        }
      },

      // 2. Create release
      // - nextVersion comes from the first task in `publish`
      // - buildDir comes from the first task in `publish`
      {
        title: `Create release`,
        task: async (ctx, task) => {
          //   console.log(res);
          // Get next version from context, fir
          const { nextVersion, txData } = ctx;
          if (!nextVersion) throw Error("Missing ctx.nextVersion");
          const tag = `v${nextVersion}`;

          // Delete all releases that have the name tag or name
          // If there are no releases, repos.listReleases will return []
          task.output = "Deleting existing release...";
          await github.deteleReleaseAndAssets(tag);

          // Plain text file with should contain the IPFS hash of the release
          // Necessary for the installer script to fetch the latest content hash
          // of the eth clients. The resulting hashes are used by the DAPPMANAGER
          // to install an eth client when the user does not want to use a remote node
          const contentHashPath = path.join(buildDir, contentHashFile);
          fs.writeFileSync(contentHashPath, releaseMultiHash);

          // Add setup-wizard file to the manifest since packages distributed on install
          // only include their manifest and compose.
          // TODO: Track issue for a better solution https://github.com/dappnode/DNP_DAPPMANAGER/issues/570
          compactManifestIfCore(buildDir);

          // Remove `build` property AFTER building. Otherwise it may break ISO installations
          // https://github.com/dappnode/DAppNode_Installer/issues/161
          composeDeleteBuildProperties({ dir: buildDir, composeFileName });

          task.output = `Creating release for tag ${tag}...`;
          await github.createReleaseAndUploadAssets(tag, {
            body: getReleaseBody(txData),
            // Tag as pre-release until it is actually published in APM mainnet
            prerelease: true,
            assetsDir: buildDir,
            // Used to ignore duplicated legacy .tar.xz image
            ignorePattern: /\.tar\.xz$/
          });

          // Clean content hash file so the directory uploaded to IPFS is the same
          // as the local build_* dir. User can then `ipfs add -r` and get the same hash
          fs.unlinkSync(contentHashPath);
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

// Utils

/**
 * Write the release body
 * #### TODO: Extend this to automatically write the body
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
