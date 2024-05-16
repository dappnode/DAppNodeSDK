import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir, defaultVariantsDirName } from "../../../params.js";
import { shell } from "../../../utils/shell.js";
import { getGitHead } from "../../../utils/git.js";
import { buildAndComment } from "../build/index.js";
import {
  writeManifest,
  writeCompose,
  readManifest
} from "../../../files/index.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Compose, Manifest } from "@dappnode/types";
import { GitSettings, GithubSettings, UpstreamSettings } from "./types.js";
import { printSettings, getInitialSettings } from "./settings/index.js";
import { ManifestFormat } from "../../../files/manifest/types.js";
import {
  closeOldPrs,
  getBumpPrBody,
  getGithubSettings,
  isBranchNew
} from "./github/index.js";
import path from "path";
import { getAllVariantsInPath } from "../../../files/variants/getAllPackageVariants.js";

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
  use_variants?: boolean;
  variants_dir: string;
  skip_build?: boolean;
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
    use_variants: {
      description: `It will use the dappnode_package.json and docker-compose.yml files in the root of the project together with the specific ones defined for each package variant to build all of them`,
      type: "boolean"
    },
    variants_dir: {
      description: `Path to the directory where the package variants are located (only for packages that support it and combined with either "--all-variants" or "--variants"). By default, it is ${defaultVariantsDirName}`,
      type: "string",
      default: defaultVariantsDirName
    },
    skip_build: {
      description: `Only create the bump PR without building the package`,
      type: "boolean"
    }
  },
  handler: async (args): Promise<void> => await gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  rootDir: dir = defaultDir,
  eth_provider: userEthProvider,
  use_fallback: useFallback,
  use_variants: useVariants,
  variants_dir: variantsDir,
  skip_build: skipBuild
}: CliCommandOptions): Promise<void> {
  const {
    upstreamSettings,
    manifestData: { manifest, format: manifestFormat },
    compose,
    gitSettings,
    ethProvider
  } = await getInitialSettings({ dir, userEthProvider, useFallback });
  if (!upstreamSettings) {
    console.log("There are no upstream repos/versions defined in the manifest");
    return;
  }

  if (
    upstreamSettings.every(
      ({ manifestVersion, githubVersion }) => manifestVersion === githubVersion
    )
  ) {
    console.log("All versions are up-to-date");
    return;
  }

  printSettings(upstreamSettings, gitSettings, ethProvider);

  const githubSettings = await getGithubSettings(dir, upstreamSettings);
  const { branchName, repo } = githubSettings;
  if (!(await isBranchNew({ branchName, repo }))) {
    // We assume the PR was already opened
    console.log(`Branch ${branchName} already exists`);
    return;
  }

  updateComposeUpstreamVersions(dir, compose, upstreamSettings);

  updateManifestUpstreamVersion({
    manifest,
    manifestFormat,
    upstreamSettings,
    dir
  });

  await updateManifestPkgVersion({
    dir,
    ethProvider,
    allVariants: useVariants,
    variantsDir
  });

  await prepareAndCommitChanges({
    gitSettings,
    upstreamSettings,
    githubSettings
  });

  try {
    await closeOldPrs(repo, branchName);
  } catch (e) {
    console.warn("Could not close old linked PRs", e);
  }

  if (skipBuild) {
    console.log("Skipping build and comment stage due to --skip_build flag");
    return;
  }

  const gitHead = await getGitHead();
  await buildAndComment({ dir, commitSha: gitHead.commit, branch: branchName });
}

/**
 * Updates Docker Compose service build arguments with new versions based on `upstreamRepoVersions`.
 * Creates a deep copy of `compose`, modifies build arguments as needed, and writes the updated
 * compose to `dir` if changes occur. Returns an object detailing updates or `null` if no update is needed.
 *
 * @param {string} dir - Directory for the Compose file.
 * @param {Compose} compose - Original Docker Compose configuration.
 * @param {UpstreamSettings[]} upstreamSettings - New versions for the Compose services.
 */
function updateComposeUpstreamVersions(
  dir: string,
  compose: Compose,
  upstreamSettings: UpstreamSettings[]
): void {
  const newCompose: Compose = JSON.parse(JSON.stringify(compose)); // Deep copy

  for (const upstreamItem of upstreamSettings) {
    // Checks if the service includes a build argument with the same name as the
    // upstream item (e.g. "GETH_VERSION" is a build argument for the Geth service)
    for (const [, service] of Object.entries(newCompose.services))
      if (
        typeof service.build !== "string" &&
        service.build?.args &&
        upstreamItem.arg in service.build.args
      )
        service.build.args[upstreamItem.arg] = upstreamItem.githubVersion;
  }

  writeCompose(newCompose, { dir });
}

/**
 * Updates the manifest with new version tags based on the provided `composeVersionsToUpdate`
 * and optionally fetches a new version for the manifest. The updated manifest is returned.
 * @param {Object} options - The options for updating the manifest.
 * @param {Manifest} options.manifest - The manifest object to update.
 * @param {UpstreamSettings[]} options.upstreamSettings - The new versions for the manifest.
 * @param {string} options.dir - Directory path where the manifest will be saved.
 * @param {string} options.ethProvider - Ethereum provider URL.
 * @returns {Promise<Manifest>} The updated manifest object.
 */
function updateManifestUpstreamVersion({
  manifest,
  manifestFormat,
  upstreamSettings,
  dir
}: {
  manifest: Manifest;
  manifestFormat: ManifestFormat;
  upstreamSettings: UpstreamSettings[];
  dir: string;
}): void {
  if (manifest.upstream) {
    for (const upstreamItem of manifest.upstream) {
      const versionUpdate = upstreamSettings.find(
        ({ repo }) => repo === upstreamItem.repo
      )?.githubVersion;

      if (versionUpdate) upstreamItem.version = versionUpdate;
    }
  } else {
    // There should be only one upstream repo in the legacy format
    manifest.upstreamVersion = upstreamSettings[0].githubVersion;
  }

  try {
    writeManifest(manifest, manifestFormat, { dir });
  } catch (e) {
    throw new Error(`Error writing manifest: ${e.message}`);
  }
}

async function updateManifestPkgVersion({
  dir,
  ethProvider,
  allVariants,
  variantsDir
}: {
  dir: string;
  ethProvider: string;
  allVariants?: boolean;
  variantsDir: string;
}): Promise<void> {
  const manifestDirs = allVariants
    ? getAllVariantsInPath(variantsDir).map(variant =>
        path.join(variantsDir, variant)
      )
    : [dir];

  for (const dir of manifestDirs) {
    try {
      const { manifest, format } = readManifest([{ dir }]);
      manifest.version = await getNewManifestVersion({ dir, ethProvider });

      console.log(
        `New manifest version for ${manifest.name}: ${manifest.version}`
      );

      writeManifest(manifest, format, { dir });
    } catch (e) {
      // Not throwing an error here because updating the manifest version is not critical
      console.error(`Could not fetch new manifest version: ${e}`);
    }
  }
}

async function getNewManifestVersion({
  ethProvider,
  dir
}: {
  ethProvider: string;
  dir: string;
}): Promise<string> {
  try {
    const {
      manifest: { name }
    } = readManifest([{ dir }]);

    return await getNextVersionFromApm({
      type: "patch",
      ethProvider,
      ensName: name
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) {
      console.log("Package not found in APM (probably not published yet)");
      console.log("Manifest version set to default 0.1.0");
      return "0.1.0";
    } else {
      e.message = `Error getting next version from apm: ${e.message}`;
      throw e;
    }
  }
}

async function prepareAndCommitChanges({
  gitSettings,
  upstreamSettings,
  githubSettings
}: {
  gitSettings: GitSettings;
  upstreamSettings: UpstreamSettings[];
  githubSettings: GithubSettings;
}) {
  const { branchName, branchRef } = githubSettings;
  const commitMsg = createCommitMessage(upstreamSettings);

  console.log(`commitMsg: ${commitMsg}`);

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await configureGitUser(gitSettings);
  await checkoutNewBranch(branchName);
  await commitAndPushChanges({ commitMsg, branchRef });
  await attemptToOpenPR({ commitMsg, upstreamSettings, githubSettings });
}

function createCommitMessage(upstreamSettings: UpstreamSettings[]): string {
  return `bump ${upstreamSettings
    .flatMap(({ repo, githubVersion }) => `${repo} to ${githubVersion}`)
    .join(", ")}`;
}

async function configureGitUser({ userName, userEmail }: GitSettings) {
  await shell(`git config user.name ${userName}`);
  await shell(`git config user.email ${userEmail}`);
}

async function checkoutNewBranch(branchName: string) {
  await shell(`git checkout -b ${branchName}`);
}

async function commitAndPushChanges({
  commitMsg,
  branchRef
}: {
  commitMsg: string;
  branchRef: string;
}) {
  await shell(`git commit -a -m "${commitMsg}"`, { pipeToMain: true });
  await shell(`git push -u origin ${branchRef}`, { pipeToMain: true });
}

async function attemptToOpenPR({
  commitMsg,
  upstreamSettings,
  githubSettings: { repo, repoData, branchName }
}: {
  commitMsg: string;
  upstreamSettings: UpstreamSettings[];
  githubSettings: GithubSettings;
}) {
  // Skip PR creation for testing
  if (process.env.ENVIRONMENT === "TEST") return;

  await repo.openPR({
    from: branchName,
    to: repoData.data.default_branch,
    title: commitMsg,
    body: getBumpPrBody(upstreamSettings)
  });
}
