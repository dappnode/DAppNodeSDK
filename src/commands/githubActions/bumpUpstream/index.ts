import path from "path";
import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { branchNameRoot, defaultDir } from "../../../params.js";
import { Github } from "../../../providers/github/Github.js";
import {
  isUndesiredRelease,
  getPrBody,
  getUpstreamVersionTag,
  VersionsToUpdate,
} from "./format.js";
import { shell } from "../../../utils/shell.js";
import { parseCsv } from "../../../utils/csv.js";
import { getLocalBranchExists, getGitHead } from "../../../utils/git.js";
import { arrIsUnique } from "../../../utils/array.js";
import { buildAndComment } from "../build/index.js";
import { closeOldPrs } from "./closeOldPrs.js";
import {
  readManifest,
  writeManifest,
  readCompose,
  writeCompose
} from "../../../files/index.js";
import { readBuildSdkEnvFileNotThrow } from "../../../utils/readBuildSdkEnv.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { getFirstAvailableEthProvider } from "../../../utils/tryEthProviders.js";
import { ManifestFormat } from "../../../files/manifest/types.js";
import { Compose, Manifest } from "@dappnode/types";
import { isEmpty } from "lodash-es";

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
  template: boolean;
}

interface UpstreamSettings {
  upstreamRepo: string;
  upstreamArg: string;
}

interface GitSettings {
  userName: string;
  userEmail: string;
}

interface GithubSettings {
  repo: Github;
  repoData: Awaited<ReturnType<Github["getRepo"]>>;
  branchName: string;
  branchRef: string;
}

interface GitBranch {
  branchName: string;
  branchRef: string;
}

interface InitialSetupData {
  upstreamSettings: UpstreamSettings[];
  manifestData: {
    manifest: Manifest;
    format: ManifestFormat;
  };
  compose: Compose;
}
type UpstreamRepo = {
  repo: string;
  repoSlug: string;
  newVersion: string
};

type UpstreamRepoMap = {
  [upstreamArg: string]: UpstreamRepo;
};

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
      description: "The directory tree corresponds to a template package with different variants",
      default: false,
      type: "boolean"
    }
  },
  handler: async (args): Promise<void> => gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  dir = defaultDir,
  eth_provider: userEthProvider,
  use_fallback: useFallback,
  template
}: CliCommandOptions): Promise<void> {

  const { upstreamSettings, manifestData: { manifest, format }, compose } = await readInitialSetup(dir);

  const gitSettings = getGitSettings();

  const ethProviders = getEthProviders(useFallback, userEthProvider);

  printSettings(upstreamSettings, gitSettings, manifest, compose, ethProviders);

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

  const ethProviderAvailable = await getFirstAvailableEthProvider({
    providers: ethProviders
  });

  if (!ethProviderAvailable)
    throw Error(`No eth provider available. Tried: ${ethProviders.join(", ")}`);

  manifest.version = await getNewManifestVersion({ dir, ethProviderAvailable });

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

function getGitSettings(): GitSettings {
  const githubActor = process.env.GITHUB_ACTOR || "bot";
  const userEmail = `${githubActor}@users.noreply.github.com`;

  return {
    userName: githubActor,
    userEmail
  };
}

function getEthProviders(useFallback: boolean, userEthProvider: string): string[] {
  const defaultEthProviders = ["remote", "infura"];

  const ethProviders = useFallback
    ? [userEthProvider, ...defaultEthProviders.filter(p => p !== userEthProvider)]
    : [userEthProvider];

  return ethProviders;
}

function printSettings(upstreamSettings: UpstreamSettings[], gitSettings: GitSettings, manifest: Manifest, compose: Compose, ethProviders: string[]) {

  console.log(`

  Upstream Settings - ${JSON.stringify(upstreamSettings, null, 2)}

  Git Settings - ${JSON.stringify(gitSettings, null, 2)}
  
  Manifest - ${JSON.stringify(manifest, null, 2)}
  
  Compose - ${JSON.stringify(compose, null, 2)}
  
  ETH Providers - ${JSON.stringify(ethProviders, null, 2)}

  `);
}


async function readInitialSetup(dir: string): Promise<InitialSetupData> {
  const envFileArgs = readBuildSdkEnvFileNotThrow(dir);

  const { manifest, format } = readManifest({ dir });
  const compose = readCompose({ dir });

  const upstreamRepos = envFileArgs
    ? [envFileArgs._BUILD_UPSTREAM_REPO]
    : parseCsv(manifest.upstreamRepo);
  const upstreamArgs = envFileArgs
    ? [envFileArgs._BUILD_UPSTREAM_VERSION]
    : parseCsv(manifest.upstreamArg || "UPSTREAM_VERSION");

  // Create upstream settings after validation
  validateUpstreamData(upstreamRepos, upstreamArgs);
  const upstreamSettings = upstreamRepos.map((repo, i) => ({
    upstreamRepo: repo,
    upstreamArg: upstreamArgs[i],
  }));

  return {
    upstreamSettings,
    manifestData: { manifest, format },
    compose,
  };
}

function validateUpstreamData(upstreamRepos: string[], upstreamArgs: string[]) {
  if (upstreamRepos.length < 1)
    throw new Error("Must provide at least one 'upstream_repo'");

  if (upstreamRepos.length !== upstreamArgs.length)
    throw new Error(`'upstream_repo' must have the same length as 'upstream_argNames'. Got ${upstreamRepos.length} repos and ${upstreamArgs.length} args.`);

  if (!arrIsUnique(upstreamRepos))
    throw new Error("upstreamRepos not unique");


  if (!arrIsUnique(upstreamArgs))
    throw new Error("upstreamArgs not unique");
}

async function getUpstreamRepoVersions(upstreamSettings: UpstreamSettings[]): Promise<UpstreamRepoMap> {

  const upstreamRepoVersions: UpstreamRepoMap = {};

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
  ethProviderAvailable,
  dir
}: {
  ethProviderAvailable: string;
  dir: string;
}): Promise<string> {
  try {
    return await getNextVersionFromApm({
      type: "patch",
      ethProvider: ethProviderAvailable,
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

function getBranch(upstreamVersions: UpstreamRepoMap): GitBranch {
  const branchName = branchNameRoot +
    Array.from(Object.values(upstreamVersions))
      .map(({ repo, newVersion }) => `${repo}@${newVersion}`)
      .join(",");
  const branchRef = `refs/heads/${branchName}`;

  return { branchName, branchRef };
}

async function getGitHubSettings(dir: string, upstreamVersions: UpstreamRepoMap): Promise<GithubSettings> {
  const thisRepo = Github.fromLocal(dir);
  const repoData = await thisRepo.getRepo();
  const branch = getBranch(upstreamVersions);
  return { repo: thisRepo, repoData, ...branch };
}

async function isBranchNew({ branchName, repo }: { branchName: string, repo: Github }): Promise<boolean> {
  const [remoteBranchExists, localBranchExists] = await Promise.all([
    repo.branchExists(branchName),
    getLocalBranchExists(branchName),
  ]);

  return remoteBranchExists || localBranchExists;
}