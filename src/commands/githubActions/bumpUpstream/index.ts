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
import { Compose } from "@dappnode/types";
import { isEmpty } from "lodash-es";
import { UpstreamSettings, UpstreamRepoMap, VersionsToUpdate } from "./types.js";
import { closeOldPrs, getGitHubSettings, getPrBody, getUpstreamVersionTag, isBranchNew, isUndesiredRelease } from "./git.js";
import { printSettings, readInitialSetup } from "./setup.js";

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

  const { repo, repoData, branchName, branchRef } = await getGitHubSettings(dir, upstreamRepoVersions);

  if (!(await isBranchNew({ branchName, repo }))) {
    console.log(`Branch ${branchName} already exists`);
    return;
  }

  const versionsToUpdate = getVersionsToUpdate(compose, upstreamRepoVersions);

  if (isEmpty(versionsToUpdate)) {
    console.log("All versions are up-to-date");
    return;
  }

  manifest.upstreamVersion = getUpstreamVersionTag(versionsToUpdate);

  manifest.version = await getNewManifestVersion({ dir, ethProvider });

  writeManifest(manifest, format, { dir });
  writeCompose(compose, { dir });

  const commitMsg = `bump ${Object.entries(versionsToUpdate)
    .map(([repoSlug, { newVersion }]) => `${repoSlug} to ${newVersion}`)
    .join(", ")
    }`;

  console.log(`commitMsg: ${commitMsg}`);

  console.log(await shell(`cat ${path.join(dir, "dappnode_package.json")}`));
  console.log(await shell(`cat ${path.join(dir, "docker-compose.yml")}`));

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await shell(`git config user.name ${gitSettings.userName}`);
  await shell(`git config user.email ${gitSettings.userEmail}`);
  await shell(`git checkout -b ${branchName}`);

  // Check if there are changes
  console.log(await shell(`git status`));

  await shell(`git commit -a -m "${commitMsg}"`, {
    pipeToMain: true
  });
  await shell(`git push -u origin ${branchRef}`, {
    pipeToMain: true
  });

  // Skip PR creation for testing
  if (process.env.ENVIRONMENT === "TEST") return;

  await repo.openPR({
    from: branchName,
    to: repoData.data.default_branch,
    title: commitMsg,
    body: getPrBody(versionsToUpdate)
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
      if (isUndesiredRelease(newVersion)) {
        console.log(`This is a realease candidate - ${upstreamRepo}: ${newVersion}`);
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

function getVersionsToUpdate(compose: Compose, upstreamRepoVersions: UpstreamRepoMap): VersionsToUpdate {
  const versionsToUpdate: VersionsToUpdate = {};

  for (const [serviceName, service] of Object.entries(compose.services))
    if (typeof service.build === "object" && service.build.args)
      for (const [argName, argValue] of Object.entries(service.build.args)) {
        const upstreamRepoVersion = upstreamRepoVersions[argName];
        if (!upstreamRepoVersion) continue;

        const currentVersion = argValue;
        const { repoSlug, newVersion } = upstreamRepoVersion;
        if (currentVersion === newVersion) continue;

        // Update current version
        compose.services[serviceName].build = {
          ...service.build,
          args: {
            ...service.build.args,
            [argName]: newVersion
          }
        };

        // Use a Map since there may be multiple matches for the same argName
        versionsToUpdate[repoSlug] = {
          newVersion,
          currentVersion
        };

      }

  return versionsToUpdate;
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