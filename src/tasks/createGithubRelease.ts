import fs from "fs";
import path from "path";
import Listr from "listr";
import Octokit from "@octokit/rest";
import mime from "mime-types";
import retry from "async-retry";
// Utils
import { getRepoSlugFromManifest } from "../utils/getRepoSlugFromManifest";
import { getPublishTxLink } from "../utils/getLinks";
import { getCurrentCommitSha } from "../utils/getCurrentCommitSha";
import { increaseFromLocalVersion } from "../utils/versions/increaseFromLocalVersion";
import { readManifestString } from "../utils/manifest";
import { readComposeString } from "../utils/compose";
import { contentHashFile } from "../params";
import { TxData, CliGlobalOptions } from "../types";

/**
 * Create (or edit) a Github release, then upload all assets
 */

export function createGithubRelease({
  dir,
  buildDir,
  releaseMultiHash,
  createNextGithubBranch,
  verbose,
  silent
}: {
  buildDir: string;
  releaseMultiHash: string;
  createNextGithubBranch: boolean;
} & CliGlobalOptions) {
  // OAuth2 token from Github
  if (!process.env.GITHUB_TOKEN)
    throw Error("GITHUB_TOKEN ENV (OAuth2) is required");
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });

  // Gather repo data, repoSlug = "dappnode/DNP_ADMIN"
  const repoSlug =
    getRepoSlugFromManifest(dir) || process.env.TRAVIS_REPO_SLUG || "";
  const [owner, repo] = repoSlug.split("/");
  if (!repoSlug) throw Error("No repoSlug provided");
  if (!owner) throw Error(`repoSlug "${repoSlug}" hasn't an owner`);
  if (!repo) throw Error(`repoSlug "${repoSlug}" hasn't a repo`);

  return new Listr(
    [
      /**
       * 1. Handle tags
       * - If the release is triggered in travis,
       *   the trigger tag must be remove and replaced by the release tag
       * - If the release is triggered locally, the commit should be
       *   tagged and released on that tag
       */
      {
        title: `Handle tags`,
        task: async (ctx, task) => {
          /**
           * First, check if the repo exists
           */
          try {
            await octokit.repos.get({ owner, repo });
          } catch (e) {
            if (e.status === 404)
              throw Error(
                `Repo does not exist: ${owner}/${repo}. Check the manifest.repository object and correct the repo URL`
              );
            e.message = `Error verifying repo ${owner}/${repo}: ${e.message}`;
            throw e;
          }

          //   console.log(res);
          // Get next version from context, fir
          const { nextVersion } = ctx;
          if (!nextVersion) throw Error("Missing ctx.nextVersion");
          const tag = `v${nextVersion}`;
          /**
           * If the release is triggered in travis,
           * the trigger tag must be removed
           * Travis ENVs:
           * - TRAVIS=true
           * - CONTINUOUS_INTEGRATION=true
           * - TRAVIS_TAG=release/patch
           */
          const { TRAVIS, TRAVIS_TAG, TRAVIS_COMMIT } = process.env;
          if (TRAVIS && TRAVIS_TAG && TRAVIS_TAG.startsWith("release")) {
            await octokit.git
              .deleteRef({
                owner,
                repo,
                ref: `tags/${TRAVIS_TAG}`
              })
              .catch(e => {
                // Ignore error if the reference does not exist, can be deleted latter
                if (e.message.includes("Reference does not exist")) return;
                e.message = `Error deleting travis trigger tag: ${e.message}`;
                throw e;
              });
          }
          /**
           * Check if the release tag exists remotely. If so, remove it
           */
          await octokit.git
            .deleteRef({
              owner,
              repo,
              ref: `tags/${tag}`
            })
            .catch(e => {
              // Ignore error if the reference does not exist, first time creating tag
              if (e.message.includes("Reference does not exist")) return;
              e.message = `Error deleting existing tag ${tag}: ${e.message}`;
              throw e;
            });
          /**
           * Get the commit sha to be tagged
           * - If on travis, use the current TRAVIS_COMMIT
           * - Otherwise use the current HEAD commit
           */
          const sha = TRAVIS_COMMIT || (await getCurrentCommitSha());
          /**
           * Tag the current commit with the release tag
           */
          task.output = `Releasing commit ${sha} at tag ${tag}`;
          await octokit.git
            .createRef({
              owner,
              repo,
              ref: `refs/tags/${tag}`,
              sha
            })
            .catch(e => {
              e.message = `Error creating tag ${tag} at ${sha}: ${e.message}`;
              throw e;
            });
          ctx.latestSha = sha;
        }
      },
      /**
       * 2. Create release
       * - nextVersion comes from the first task in `publish`
       */
      {
        title: `Create release`,
        task: async (ctx, task) => {
          //   console.log(res);
          // Get next version from context, fir
          const { nextVersion, txData } = ctx;
          if (!nextVersion) throw Error("Missing ctx.nextVersion");
          const tag = `v${nextVersion}`;

          /**
           * Delete all releases that have the name tag or name
           * If there are no releases, repos.listReleases will return []
           */
          task.output = "Deleting existing release...";
          const releases = await octokit.repos
            .listReleases({ owner, repo })
            .then(res => res.data);
          const matchingReleases = releases.filter(
            ({ tag_name, name }) => tag_name === tag || name === tag
          );
          for (const matchingRelease of matchingReleases) {
            for (const asset of matchingRelease.assets) {
              await octokit.repos
                .deleteReleaseAsset({
                  owner,
                  repo,
                  asset_id: asset.id
                })
                .catch(e => {
                  e.message = `Error deleting release asset: ${e.message}`;
                  throw e;
                });
            }
            await octokit.repos
              .deleteRelease({
                owner,
                repo,
                release_id: matchingRelease.id
              })
              .catch(e => {
                e.message = `Error deleting release: ${e.message}`;
                throw e;
              });
          }

          // Create release
          task.output = `Creating release for tag ${tag}...`;
          const release = await octokit.repos
            .createRelease({
              owner,
              repo,
              tag_name: tag,
              name: tag,
              body: getReleaseBody(txData),
              prerelease: true
            })
            .catch(e => {
              e.message = `Error creating release: ${e.message}`;
              throw e;
            });
          ctx.uploadUrl = release.data.upload_url;
        }
      },
      /**
       * 3. Upload release assets
       * - buildDir comes from the first task in `publish`
       * - `release` comes from this previous task
       */
      {
        title: "Upload release assets",
        task: async (ctx, task) => {
          const url = ctx.uploadUrl;
          if (!buildDir) throw Error("buildDir not provided");
          if (!url) throw Error("uploadUrl not provided");

          // Plain text file with should contain the IPFS hash of the release
          // Necessary for the installer script to fetch the latest content hash
          // of the eth clients. The resulting hashes are used by the DAPPMANAGER
          // to install an eth client when the user does not want to use a remote node
          const contentHashPath = path.join(buildDir, contentHashFile);
          fs.writeFileSync(contentHashPath, releaseMultiHash);

          // Gather files from the build directory
          const files = fs
            .readdirSync(buildDir)
            .map(file => path.resolve(buildDir, file));

          // Upload files as assets one by one
          for (const file of files) {
            task.output = `Uploading ${file}...`;
            const contentType = mime.lookup(file) || "application/octet-stream";
            try {
              // The uploadReleaseAssetApi fails sometimes, retry 3 times
              await retry(
                async () => {
                  await octokit.repos
                    .uploadReleaseAsset({
                      url,
                      file: fs.createReadStream(file),
                      headers: {
                        "content-type": contentType,
                        "content-length": fs.statSync(file).size
                      },
                      name: path.basename(file)
                    })
                    .catch(e => {
                      e.message = `Error uploading release asset: ${e.message}`;
                      throw e;
                    });
                },
                { retries: 3 }
              );
            } catch (e) {
              console.log(e);
              throw e;
            }
          }

          // Clean content hash file so the directory uploaded to IPFS is the same
          // as the local build_* dir. User can then `ipfs add -r` and get the same hash
          fs.unlinkSync(contentHashPath);
        }
      },
      /**
       * 4. Create the next version branch and advance versions
       * - Run `dappnodesdk increase patch` to compute next version
       * - Run `git checkout -b v${FUTURE_VERSION}`
       * - git add dappnode_package.json docker-compose.yml
       * - git commit -m "Advance manifest and docker-compose versions to new version: $FUTURE_VERSION"
       * - git push origin $BRANCH_NAME
       */
      {
        title: "Create next version branch",
        enabled: () => createNextGithubBranch,
        task: async (ctx, task) => {
          try {
            const latestSha = ctx.latestSha;
            const manifestPath = "dappnode_package.json";
            const composePath = "docker-compose.yml";
            const nextVersion = await increaseFromLocalVersion({
              type: "patch",
              dir
            });
            const manifestString = readManifestString(dir);
            const composeString = readComposeString(dir);
            const branch = `v${nextVersion}`;

            // Create the next branch
            task.output = `Creating next branch ${branch}...`;
            try {
              await octokit.git.createRef({
                owner,
                repo,
                ref: `refs/heads/${branch}`,
                sha: latestSha
              });
            } catch (e) {
              // If the next version branch already exists, skip
              if (e.message.includes("Reference already exists")) return;
              else throw e;
            }

            // Fetch the manifest file's sha for the `updateFile` call
            task.output = `Advancing manifest version to ${nextVersion}...`;
            const manifestSha = await octokit.repos
              .getContents({ owner, repo, path: manifestPath })
              .then(res => res.data.sha);

            // Update the manifest making a commit to the next branch
            await octokit.repos.updateFile({
              owner,
              repo,
              path: manifestPath,
              branch,
              message: `Advance manifest to new version: ${nextVersion}`,
              // API requires content in Base64
              content: Buffer.from(manifestString).toString("base64"),
              sha: manifestSha,
              author: { name: "dappnode", email: "dappnode@dappnode.io" },
              committer: { name: "dappnode", email: "dappnode@dappnode.io" }
            });

            // Fetch the manifest file's sha for the `updateFile` call
            task.output = `Advancing compose version to ${nextVersion}...`;
            const composeSha = await octokit.repos
              .getContents({ owner, repo, path: composePath })
              .then(res => res.data.sha);

            // Update the manifest making a commit to the next branch
            await octokit.repos.updateFile({
              owner,
              repo,
              path: composePath,
              branch,
              message: `Advance compose to new version: ${nextVersion}`,
              // API requires content in Base64
              content: Buffer.from(composeString).toString("base64"),
              sha: composeSha,
              author: { name: "dappnode", email: "dappnode@dappnode.io" },
              committer: { name: "dappnode", email: "dappnode@dappnode.io" }
            });

            // Open a PR from next branch to master
            task.output = `Openning a PR to master...`;
            await octokit.pulls
              .create({
                owner,
                repo,
                title: `${branch} Release`,
                head: branch, // from
                base: "master" // to
              })
              .then(res => res.data);
          } catch (e) {
            // Non-essential step, don't stop release for a failure on this task
            console.log("\n".repeat(10));
            console.log(`Error creating next version branch:\n${e.stack}`);
            console.log("\n".repeat(10));
          }
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
  return `
# Changelog

${changelog}

# Publish transaction

\`\`\`
To: ${txData.to}
Value: ${txData.value}
Data: ${txData.data}
Gas limit: ${txData.gasLimit}
\`\`\`

You can execute this transaction from the Admin UI with Metamask by following [this pre-filled link](${link})
`.trim();
}
