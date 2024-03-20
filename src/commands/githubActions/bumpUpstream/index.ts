import path from "path";
import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir } from "../../../params.js";
import { Github } from "../../../providers/github/Github.js";
import { shell } from "../../../utils/shell.js";
import { getGitHead } from "../../../utils/git.js";
import { buildAndComment } from "../build/index.js";
import {
  writeManifest,
  writeCompose
} from "../../../files/index.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { Compose, Manifest } from "@dappnode/types";
import { isEmpty } from "lodash-es";
import { UpstreamSettings, UpstreamRepoMap, ComposeVersionsToUpdate, GitSettings, GithubSettings } from "./types.js";
import { closeOldPrs, getGitHubSettings, getPrBody, getUpstreamVersionTag, isBranchNew, isValidRelease } from "./git.js";
import { printSettings, readInitialSetup } from "./setup.js";
import { ManifestFormat } from "../../../files/manifest/types.js";

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
  template: boolean;
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
    }
  },
  handler: async (args): Promise<void> => gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  dir = defaultDir,
  eth_provider: userEthProvider,
  use_fallback: useFallback,
}: CliCommandOptions): Promise<void> {

  const { upstreamSettings, manifestData: { manifest, format }, compose, gitSettings, ethProvider } = await readInitialSetup({ dir, userEthProvider, useFallback });
  printSettings(upstreamSettings, gitSettings, manifest, compose, ethProvider);

  const upstreamRepoVersions = await getUpstreamRepoVersions(upstreamSettings);
  if (isEmpty(upstreamRepoVersions)) {
    console.log("There are no new versions to update");
    return;
  }

  const githubSettings = await getGitHubSettings(dir, upstreamRepoVersions);
  const { branchName, repo } = githubSettings;
  if (!(await isBranchNew({ branchName, repo }))) {
    console.log(`Branch ${branchName} already exists`);
    return;
  }

  const composeVersionsToUpdate = updateComposeVersions(dir, compose, upstreamRepoVersions);
  if (isEmpty(composeVersionsToUpdate)) {
    console.log("All versions are up-to-date");
    return;
  }

  updateManifest({ manifest, manifestFormat: format, composeVersionsToUpdate, dir, ethProvider });

  await prepareAndCommitChanges({
    dir,
    gitSettings,
    composeVersionsToUpdate,
    githubSettings,
  });

  try {
    await closeOldPrs(repo, branchName);
  } catch (e) {
    console.error("Error on closeOldPrs", e);
  }

  const gitHead = await getGitHead();
  await buildAndComment({ dir, commitSha: gitHead.commit, branch: branchName });
}

async function getUpstreamRepoVersions(upstreamSettings: UpstreamSettings[]): Promise<UpstreamRepoMap> {

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

  return upstreamRepoVersions;
}

function updateComposeVersions(dir: string, compose: Compose, upstreamRepoVersions: UpstreamRepoMap): ComposeVersionsToUpdate {
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

  if (!isEmpty(versionsToUpdate))
    writeCompose(newCompose, { dir });

  return versionsToUpdate;
}

async function updateManifest({
  manifest,
  manifestFormat,
  composeVersionsToUpdate,
  dir,
  ethProvider,
}: {
  manifest: Manifest;
  manifestFormat: ManifestFormat;
  composeVersionsToUpdate: ComposeVersionsToUpdate;
  dir: string;
  ethProvider: string;
}): Promise<void> {

  manifest.upstreamVersion = getUpstreamVersionTag(composeVersionsToUpdate);

  manifest.version = await getNewManifestVersion({ dir, ethProvider });

  writeManifest(manifest, manifestFormat, { dir });
}

async function getNewManifestVersion({
  ethProvider,
  dir
}: {
  ethProvider: string;
  dir: string;
}): Promise<string> {
  try {
    return await getNextVersionFromApm({
      type: "patch",
      ethProvider,
      dir
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) {
      console.log("Package not found in APM (probably not published yet");
      console.log("Manifest version set to default 0.1.0");
      return "0.1.0";
    } else {
      e.message = `Error getting next version from apm: ${e.message}`;
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

  console.log(`commitMsg: ${commitMsg}`);
  console.log(await shell(`cat ${path.join(dir, "dappnode_package.json")}`));
  console.log(await shell(`cat ${path.join(dir, "docker-compose.yml")}`));

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
    .join(", ")}`;
}

async function configureGitUser({ userName, userEmail }: GitSettings) {
  await shell(`git config user.name ${userName}`);
  await shell(`git config user.email ${userEmail}`);
}

async function checkoutNewBranch(branchName: string) {
  await shell(`git checkout -b ${branchName}`);
}

async function commitAndPushChanges({ commitMsg, branchRef }: { commitMsg: string, branchRef: string }) {
  await shell(`git commit -a -m "${commitMsg}"`, { pipeToMain: true });
  await shell(`git push -u origin ${branchRef}`, { pipeToMain: true });
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
    body: getPrBody(composeVersionsToUpdate)
  });
}
