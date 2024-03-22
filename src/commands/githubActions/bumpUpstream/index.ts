import path from "path";
import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir, defaultManifestFileName, defaultVariantsDir } from "../../../params.js";
import { Github } from "../../../providers/github/Github.js";
import { shell } from "../../../utils/shell.js";
import { getGitHead } from "../../../utils/git.js";
import { buildAndComment } from "../build/index.js";
import {
  writeManifest,
  writeCompose,
  readVariantManifests
} from "../../../files/index.js";
import { Compose, Manifest } from "@dappnode/types";
import { isEmpty } from "lodash-es";
import { UpstreamSettings, UpstreamRepoMap, ComposeVersionsToUpdate, GitSettings, GithubSettings } from "./types.js";
import { printSettings, getInitialSettings } from "./settings/index.js";
import { ManifestFormat } from "../../../files/manifest/types.js";
import { closeOldPrs, getBumpPrBody, getGithubSettings, getUpstreamVersionTag, isBranchNew, isValidRelease } from "./github/index.js";
import { getNextVersionFromApmByEns } from "../../../utils/versions/getNextVersionFromApmByEns.js";

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
  template: boolean;
  variants_dir: string;
}

// This action should be run periodically

export const gaBumpUpstream: CommandModule<
  CliGlobalOptions,
  CliCommandOptions
> = {
  command: "bump-upstream",
  describe:
    "Check if upstream repo has released a new version and open a PR with version bump",
  builder: {
    eth_provider: {
      alias: "p",
      description:
        "Specify the eth provider to use: 'remote' (default), 'infura', 'localhost:5002'",
      default: "remote",
      type: "string"
    },
    use_fallback: {
      alias: "f",
      description:
        "Use fallback eth provider if main provider fails: false (default), true. If main provider fails, it will try to use 'remote' first and then 'infura'",
      default: true,
      type: "boolean"
    },
    template: {
      alias: "t",
      description: "The project corresponds to a template repo, so the manifest and compose files will be updated accordingly in the root and in the package variants",
      default: false,
      type: "boolean"
    },
    variants_dir: {
      description: "Specify the directory where the package variants are located",
      default: defaultVariantsDir,
      type: "string"
    }
  },
  handler: async (args): Promise<void> => await gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  dir = defaultDir,
  eth_provider: userEthProvider,
  use_fallback: useFallback,
  template: templateMode = false,
  variants_dir: variantsDir = defaultVariantsDir
}: CliCommandOptions): Promise<void> {

  const { upstreamSettings, manifestData: { manifest, format }, compose, gitSettings, ethProvider } = await getInitialSettings({ dir, userEthProvider, useFallback });
  printSettings(upstreamSettings, gitSettings, manifest, compose, ethProvider);

  const upstreamRepoVersions = await getUpstreamRepoVersions(upstreamSettings);
  if (!upstreamRepoVersions) {
    console.log("There are no new versions to update");
    return;
  }

  const githubSettings = await getGithubSettings(dir, upstreamRepoVersions);
  const { branchName, repo } = githubSettings;
  if (!(await isBranchNew({ branchName, repo }))) {
    // We assume the PR was already opened
    console.log(`Branch ${branchName} already exists`);
    return;
  }

  const composeVersionsToUpdate = updateComposeVersions(dir, compose, upstreamRepoVersions);
  if (!composeVersionsToUpdate) {
    console.log("All versions are up-to-date");
    return;
  }

  if (templateMode)
    // Does not throw error
    await updatePackageVariantManifests({ dir, variantsDir, ethProvider });

  await updateManifest({ manifest, manifestFormat: format, composeVersionsToUpdate, dir, ethProvider });

  await prepareAndCommitChanges({
    dir,
    gitSettings,
    composeVersionsToUpdate,
    githubSettings,
  });

  try {
    await closeOldPrs(repo, branchName);
  } catch (e) {
    console.warn("Could not close old linked PRs", e);
  }

  const gitHead = await getGitHead();
  await buildAndComment({ dir, commitSha: gitHead.commit, branch: branchName });
}

async function getUpstreamRepoVersions(upstreamSettings: UpstreamSettings[]): Promise<UpstreamRepoMap | null> {

  const upstreamRepoVersions: UpstreamRepoMap = {};

  try {
    for (const { upstreamArg, upstreamRepo } of upstreamSettings) {

      const [owner, repo] = upstreamRepo.split("/");
      const githubRepo = new Github({ owner, repo });

      const releases = await githubRepo.listReleases();
      const latestRelease = releases[0];
      if (!latestRelease) throw Error(`No release found for ${upstreamRepo}`);

      const newVersion = latestRelease.tag_name;
      if (!isValidRelease(newVersion)) {
        console.log(`This is not a valid release (probably a release candidate) - ${upstreamRepo}: ${newVersion}`);
        continue;
      }

      upstreamRepoVersions[upstreamArg] = { repo, repoSlug: upstreamRepo, newVersion };
      console.log(`Fetch latest version(s) - ${upstreamRepo}: ${newVersion}`);
    }
  } catch (e) {
    console.error("Error fetching upstream repo versions:", e);
    throw e;
  }

  if (isEmpty(upstreamRepoVersions)) return null;

  return upstreamRepoVersions;
}

/**
 * Updates Docker Compose service build arguments with new versions based on `upstreamRepoVersions`.
 * Creates a deep copy of `compose`, modifies build arguments as needed, and writes the updated
 * compose to `dir` if changes occur. Returns an object detailing updates or `null` if no update is needed.
 *
 * @param {string} dir - Directory for the Compose file.
 * @param {Compose} compose - Original Docker Compose configuration.
 * @param {UpstreamRepoMap} upstreamRepoVersions - Mapping of dependencies to their new versions.
 * @return {ComposeVersionsToUpdate | null} - Details of updated versions or null.
 */
function updateComposeVersions(dir: string, compose: Compose, upstreamRepoVersions: UpstreamRepoMap): ComposeVersionsToUpdate | null {
  const newCompose = JSON.parse(JSON.stringify(compose)); // Deep copy
  const versionsToUpdate: ComposeVersionsToUpdate = {};

  for (const [serviceName, service] of Object.entries(compose.services)) {

    if (typeof service.build !== "object" || !service.build.args)
      continue;

    for (const [argName, currentVersion] of Object.entries(service.build.args)) {
      const upstreamVersionInfo = upstreamRepoVersions[argName];

      if (!upstreamVersionInfo || currentVersion === upstreamVersionInfo.newVersion)
        continue;

      newCompose.services[serviceName].build.args[argName] = upstreamVersionInfo.newVersion;

      versionsToUpdate[upstreamVersionInfo.repoSlug] = {
        newVersion: upstreamVersionInfo.newVersion,
        currentVersion,
      };
    }
  }

  if (isEmpty(versionsToUpdate)) {
    return null;
  } else {
    writeCompose(newCompose, { dir });
  }

  return versionsToUpdate;
}

/**
 * Updates the manifest with a new version and upstream version tag based on the
 * provided `composeVersionsToUpdate`. It also writes the updated manifest to disk.
 */
async function updateManifest({
  manifest,
  manifestFormat,
  manifestFileName = defaultManifestFileName,
  composeVersionsToUpdate,
  dir,
  ethProvider,
}: {
  manifest: Manifest;
  manifestFormat: ManifestFormat;
  manifestFileName?: string;
  composeVersionsToUpdate: ComposeVersionsToUpdate;
  dir: string;
  ethProvider: string;
}): Promise<void> {

  try {
    manifest.upstreamVersion = getUpstreamVersionTag(composeVersionsToUpdate);

    manifest.version = await getNewManifestVersion({ ensName: manifest.name, ethProvider });

    writeManifest(manifest, manifestFormat, { dir, manifestFileName });
  } catch (e) {
    throw Error(`Error updating manifest: ${e.message}`);
  }
}

/**
 * Updates the manifest version for each package variant based on the ENS name.
 * It also writes the updated manifest to disk.
 * Upstream version is not defined for package variants, only in root manifest.
 */
async function updatePackageVariantManifests({
  dir,
  variantsDir = defaultVariantsDir,
  variantManifestName = defaultManifestFileName,
  ethProvider
}: {
  dir: string;
  variantsDir: string;
  variantManifestName?: string;
  ethProvider: string;
}): Promise<void> {

  const variantManifests = readVariantManifests({ dir, variantsDir, manifestFileName: variantManifestName });

  for (const [variant, { manifest: variantManifest }] of Object.entries(variantManifests)) {
    try {
      const ensName = variantManifest.name;

      if (!ensName) {
        console.warn(`Could not update manifest version for variant ${variant}: name is missing`);
        continue;
      }

      variantManifest.version = await getNewManifestVersion({ ensName, ethProvider });
      // TODO: Uncomment this after https://github.com/dappnode/DAppNodeSDK/pull/404 has been merged and this branch is rebased
      // writeManifest<Partial<Manifest>>(variantManifest, ManifestFormat.json, { dir: path.join(dir, variantsDir, variant) });
    } catch (e) {
      console.error(`Error updating manifest for variant ${variant}: ${e.message} `);
    }
  }

}

async function getNewManifestVersion({
  ethProvider,
  ensName,
}: {
  ethProvider: string;
  ensName: string;
}): Promise<string> {
  try {
    return await getNextVersionFromApmByEns({
      type: "patch",
      ethProvider,
      ensName,
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) {
      console.log("Package not found in APM (probably not published yet");
      console.log("Manifest version set to default 0.1.0");
      return "0.1.0";
    } else {
      e.message = `Error getting next version from apm: ${e.message} `;
      throw e;
    }
  }
}

async function prepareAndCommitChanges({
  dir,
  gitSettings,
  composeVersionsToUpdate,
  githubSettings,
}: {
  dir: string;
  gitSettings: GitSettings;
  composeVersionsToUpdate: ComposeVersionsToUpdate;
  githubSettings: GithubSettings;
}) {
  const { branchName, branchRef } = githubSettings;
  const commitMsg = createCommitMessage(composeVersionsToUpdate);

  console.log(`commitMsg: ${commitMsg} `);
  console.log(await shell(`cat ${path.join(dir, "dappnode_package.json")} `));
  console.log(await shell(`cat ${path.join(dir, "docker-compose.yml")} `));

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await configureGitUser(gitSettings);
  await checkoutNewBranch(branchName);
  await commitAndPushChanges({ commitMsg, branchRef });
  await attemptToOpenPR({ commitMsg, composeVersionsToUpdate, githubSettings });
}

function createCommitMessage(composeVersionsToUpdate: ComposeVersionsToUpdate): string {
  return `bump ${Object.entries(composeVersionsToUpdate)
    .map(([repoSlug, { newVersion }]) => `${repoSlug} to ${newVersion}`)
    .join(", ")
    } `;
}

async function configureGitUser({ userName, userEmail }: GitSettings) {
  await shell(`git config user.name ${userName} `);
  await shell(`git config user.email ${userEmail} `);
}

async function checkoutNewBranch(branchName: string) {
  await shell(`git checkout - b ${branchName} `);
}

async function commitAndPushChanges({ commitMsg, branchRef }: { commitMsg: string, branchRef: string }) {
  await shell(`git commit - a - m "${commitMsg}"`, { pipeToMain: true });
  await shell(`git push - u origin ${branchRef} `, { pipeToMain: true });
}

async function attemptToOpenPR({
  commitMsg,
  composeVersionsToUpdate,
  githubSettings: { repo, repoData, branchName }
}: {
  commitMsg: string;
  composeVersionsToUpdate: ComposeVersionsToUpdate;
  githubSettings: GithubSettings;
}) {
  // Skip PR creation for testing
  if (process.env.ENVIRONMENT === "TEST") return;

  await repo.openPR({
    from: branchName,
    to: repoData.data.default_branch,
    title: commitMsg,
    body: getBumpPrBody(composeVersionsToUpdate)
  });
}
