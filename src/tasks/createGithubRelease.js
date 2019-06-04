const fs = require("fs");
const path = require("path");
const Listr = require("listr");
const getRepoSlugFromManifest = require("../utils/getRepoSlugFromManifest");
const getTxDataAdminUiLink = require("../utils/getTxDataAdminUiLink");
const Octokit = require("@octokit/rest");
const mime = require("mime-types");
const retry = require("async-retry");

/**
 * Create (or edit) a Github release, then upload all assets
 */

function createGithubRelease({ dir, buildDir, verbose, silent }) {
  // OAuth2 token from Github
  if (!process.env.GITHUB_TOKEN)
    throw Error("GITHUB_TOKEN ENV (OAuth2) is required");
  const octokit = new Octokit({
    auth: `token ${process.env.GITHUB_TOKEN}`
  });

  // Gather repo data, repoSlug = "dappnode/DNP_ADMIN"
  const repoSlug =
    getRepoSlugFromManifest({ dir }) || process.env.TRAVIS_REPO_SLUG || "";
  const [owner, repo] = repoSlug.split("/");
  if (!repoSlug) throw Error("No repoSlug provided");
  if (!owner) throw Error(`repoSlug "${repoSlug}" hasn't an owner`);
  if (!repo) throw Error(`repoSlug "${repoSlug}" hasn't a repo`);

  return new Listr(
    [
      /**
       * 1. Create release
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

          // Get release information to know if it exists
          const currentRelease = await octokit.repos
            .getReleaseByTag({
              owner: owner,
              repo: repo,
              tag: tag
            })
            .then(res => res.data)
            .catch(e => {
              if (e.status === 404) return;
              else throw e;
            });

          if (currentRelease) {
            task.output = "Deleting existing release...";
            for (const asset of currentRelease.assets) {
              await octokit.repos.deleteReleaseAsset({
                owner,
                repo,
                asset_id: asset.id
              });
            }
            await octokit.repos.deleteRelease({
              owner,
              repo,
              release_id: currentRelease.id
            });
          }

          task.output = `Creating release for tag ${tag}...`;

          // Edit or create release
          const releaseData = {
            owner,
            repo,
            tag_name: tag,
            name: tag,
            body: getReleaseBody({ txData }),
            prerelease: true,
            // Specific for updateRelease
            release_id: (currentRelease || {}).id
          };

          const release = await octokit.repos
            .createRelease(releaseData)
            .catch(e => {
              // Log full error for further details
              console.log(e);
              throw e;
            });
          ctx.uploadUrl = release.data.upload_url;
        }
      },
      /**
       * 2. Upload release assets
       * - buildDir comes from the first task in `publish`
       * - `release` comes from this previous task
       */
      {
        title: "Upload release assets",
        task: async (ctx, task) => {
          const url = ctx.uploadUrl;
          if (!buildDir) throw Error("buildDir not provided");
          if (!url) throw Error("uploadUrl not provided");

          // Gather files from the build directory
          const files = fs
            .readdirSync(buildDir)
            .map(file => path.resolve(buildDir, file));

          // Upload files as assets one by one
          for (const file of files) {
            task.output = `Uploading ${file}...`;
            try {
              // The uploadReleaseAssetApi fails sometimes, retry 3 times
              await retry(
                async () => {
                  await octokit.repos.uploadReleaseAsset({
                    url,
                    file: fs.createReadStream(file),
                    headers: {
                      "Content-Type":
                        mime.lookup(file) || "application/octet-stream",
                      "Content-Length": fs.statSync(file).size
                    },
                    name: path.basename(file)
                  });
                },
                { retries: 3 }
              );
            } catch (e) {
              console.log(e);
              throw e;
            }
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
function getReleaseBody({ txData }) {
  const link = getTxDataAdminUiLink({ txData });
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

module.exports = createGithubRelease;
