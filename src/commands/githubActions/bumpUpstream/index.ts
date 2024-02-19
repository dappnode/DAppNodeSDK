import path from "path";
import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { branchNameRoot, defaultDir } from "../../../params.js";
import { Github } from "../../../providers/github/Github.js";
import {
  isUndesiredRealease,
  getPrBody,
  getUpstreamVersionTag,
  VersionToUpdate
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

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
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
  handler: async (args): Promise<void> => await gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  dir = defaultDir,
  eth_provider,
  use_fallback
}: CliCommandOptions): Promise<void> {
  // Check if buildSdkEnvFileName file exists
  const templateArgs = readBuildSdkEnvFileNotThrow(dir);

  const { manifest, format } = readManifest({ dir });
  const compose = readCompose({ dir });

  const upstreamRepos = templateArgs
    ? [templateArgs._BUILD_UPSTREAM_REPO]
    : parseCsv(manifest.upstreamRepo);
  const upstreamArgs = templateArgs
    ? [templateArgs._BUILD_UPSTREAM_VERSION]
    : parseCsv(manifest.upstreamArg || "UPSTREAM_VERSION");

  const githubActor = process.env.GITHUB_ACTOR || "bot";
  const userName = githubActor;
  const userEmail = `${userName}@users.noreply.github.com`;

  const defaultEthProviders = ["remote", "infura"];
  const ethProvider = eth_provider;

  const ethProviders = use_fallback
    ? [ethProvider, ...defaultEthProviders.filter(p => p !== ethProvider)]
    : [ethProvider];

  console.log(`
Arguments - ${JSON.stringify({
    upstreamRepos,
    upstreamArgs,
    userName,
    userEmail
  })}

Manifest - ${JSON.stringify(manifest, null, 2)}

Compose - ${JSON.stringify(compose, null, 2)}
`);

  if (upstreamRepos.length < 1) {
    throw Error("Must provide at least one 'upstream_repo'");
  }

  if (upstreamRepos.length !== upstreamArgs.length) {
    throw Error(
      `'upstream-repo' must have the same lenght as 'upstream_argNames' \n${JSON.stringify(
        { upstreamRepos, upstreamArgs }
      )}`
    );
  }

  if (!arrIsUnique(upstreamRepos)) throw Error("upstreamRepos not unique");
  if (!arrIsUnique(upstreamArgs)) throw Error("upstreamArgs not unique");

  type UpstreamRepo = { repo: string; repoSlug: string; newVersion: string };
  // index by argName, must be unique
  const upstreamRepoVersions = new Map<string, UpstreamRepo>();

  for (const [i, repoSlug] of upstreamRepos.entries()) {
    // Fetch latest version
    const [owner, repo] = repoSlug.split("/");
    const upstreamRepo = new Github({ owner, repo });
    const releases = await upstreamRepo.listReleases();
    const latestRelease = releases[0];
    if (!latestRelease) throw Error(`No release found for ${repoSlug}`);

    const argName = upstreamArgs[i];
    const newVersion = latestRelease.tag_name;

    if (isUndesiredRealease(newVersion))
      throw Error(`This is a realease candidate`);
    upstreamRepoVersions.set(argName, { repo, repoSlug, newVersion });

    console.log(`Fetch latest version(s) - ${repoSlug}: ${newVersion}`);
  }

  // Compute branch name
  const branch =
    branchNameRoot +
    Array.from(upstreamRepoVersions.values())
      .map(({ repo, newVersion }) => `${repo}@${newVersion}`)
      .join(",");
  const branchRef = `refs/heads/${branch}`;

  // Get current upstream version
  const thisRepo = Github.fromLocal(dir);
  const repoData = await thisRepo.getRepo();
  const remoteBranchExists = await thisRepo.branchExists(branch);
  const localBranchExists = await getLocalBranchExists(branch);
  const branchExists = remoteBranchExists || localBranchExists;

  if (branchExists) {
    console.log(`Branch ${branch} already exists`);
    return;
    // TODO, do some checking
  }

  // index by repoSlug, must be unique
  const versionsToUpdateMap = new Map<string, VersionToUpdate>();

  for (const [serviceName, service] of Object.entries(compose.services))
    if (typeof service.build === "object" && service.build.args)
      for (const [argName, argValue] of Object.entries(service.build.args)) {
        const upstreamRepoVersion = upstreamRepoVersions.get(argName);
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
        versionsToUpdateMap.set(repoSlug, {
          repoSlug,
          newVersion,
          currentVersion
        });
      }

  if (versionsToUpdateMap.size == 0) {
    console.log("All versions are up-to-date");
    return;
  }

  const versionsToUpdate = Array.from(versionsToUpdateMap.values());
  manifest.upstreamVersion = getUpstreamVersionTag(versionsToUpdate);

  const ethProviderAvailable = await getFirstAvailableEthProvider({
    providers: ethProviders
  });

  if (!ethProviderAvailable)
    throw Error(`No eth provider available. Tried: ${ethProviders.join(", ")}`);

  try {
    manifest.version = await getNextVersionFromApm({
      type: "patch",
      ethProvider: ethProviderAvailable,
      dir
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) {
      console.log("Package not found in APM (probably not published yet");
      console.log("Manifest version set to default 0.1.0");
      manifest.version = "0.1.0";
    } else {
      e.message = `Error getting next version from apm: ${e.message}`;
      throw e;
    }
  }

  writeManifest(manifest, format, { dir });
  writeCompose(compose, { dir });

  const commitMsg = `bump ${versionsToUpdate
    .map(({ repoSlug, newVersion }) => `${repoSlug} to ${newVersion}`)
    .join(", ")}`;
  console.log(`commitMsg: ${commitMsg}`);

  console.log(await shell(`cat ${path.join(dir, "dappnode_package.json")}`));
  console.log(await shell(`cat ${path.join(dir, "docker-compose.yml")}`));

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await shell(`git config user.name ${userName}`);
  await shell(`git config user.email ${userEmail}`);
  await shell(`git checkout -b ${branch}`);

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

  await thisRepo.openPR({
    from: branch,
    to: repoData.data.default_branch,
    title: commitMsg,
    body: getPrBody(versionsToUpdate)
  });

  try {
    await closeOldPrs(thisRepo, branch);
  } catch (e) {
    console.error("Error on closeOldPrs", e);
  }

  const gitHead = await getGitHead();
  await buildAndComment({ dir, commitSha: gitHead.commit, branch });
}
