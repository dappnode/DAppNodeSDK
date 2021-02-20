import { CommandModule } from "yargs";
import { CliGlobalOptions, ComposeServiceBuild } from "../../../types";
import { defaultDir } from "../../../params";
import { Github } from "../../../providers/github/Github";
import { getPrBody, getUpstreamVersionTag, VersionToUpdate } from "./format";
import { shell } from "../../../utils/shell";
import { readManifest, writeManifest } from "../../../utils/manifest";
import {
  findLocalUpstreamVersion,
  readCompose,
  writeCompose
} from "../../../utils/compose";
import { parseCsv } from "../../../utils/csv";
import { getLocalBranchExists } from "../../../utils/git";

const branchNameRoot = "dappnodebot/bump-upstream/";

// This action should be run periodically

export const gaBumpUpstream: CommandModule<
  CliGlobalOptions,
  CliGlobalOptions
> = {
  command: "bump-upstream",
  describe:
    "Check if upstream repo has released a new version and open a PR with version bump",
  builder: {},
  handler: async (args): Promise<void> => await gaBumpUpstreamHandler(args)
};

export async function gaBumpUpstreamHandler({
  dir = defaultDir
}: CliGlobalOptions): Promise<void> {
  const manifest = readManifest({ dir });
  const compose = readCompose({ dir });

  const upstreamRepos = parseCsv(manifest.upstreamRepo);
  const upstreamArgs = parseCsv(manifest.upstreamArg || "UPSTREAM_VERSION");

  const githubActor = process.env.GITHUB_ACTOR || "bot";
  const userName = githubActor;
  const userEmail = `${userName}@users.noreply.github.com`;

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

  const upstreamRepoVersions: {
    repo: string;
    repoSlug: string;
    newVersion: string;
    argName: string;
  }[] = [];
  for (let i = 0; i < upstreamRepos.length; i++) {
    // Fetch latest version
    const repoSlug = upstreamRepos[i];
    const [owner, repo] = repoSlug.split("/");
    const upstreamRepo = new Github({ owner, repo });
    const releases = await upstreamRepo.listReleases();
    const latestRelease = releases[0];
    if (!latestRelease) throw Error(`No release found for ${repoSlug}`);
    upstreamRepoVersions.push({
      repo,
      repoSlug,
      newVersion: latestRelease.tag_name,
      argName: upstreamArgs[i]
    });
    console.log(
      `Fetch latest version(s) - ${repoSlug}: ${latestRelease.tag_name}`
    );
  }

  // Compute branch name
  const branch =
    branchNameRoot +
    upstreamRepoVersions
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
    // TODO, do some checking
  } else {
    const versionsToUpdate: VersionToUpdate[] = [];
    for (const { argName, repoSlug, newVersion } of upstreamRepoVersions) {
      const { serviceName, currentVersion } = findLocalUpstreamVersion(
        argName,
        compose
      );
      console.log(
        `Commit and push changes if any - ${serviceName}.${argName}: ${currentVersion} (${repoSlug})`
      );
      if (currentVersion !== newVersion) {
        const build =
          typeof compose.services[serviceName].build === "object"
            ? (compose.services[serviceName].build as ComposeServiceBuild)
            : {};

        // Update current version
        compose.services[serviceName].build = {
          ...build,
          args: {
            ...build.args,
            [argName]: newVersion
          }
        };
        versionsToUpdate.push({ repoSlug, newVersion, currentVersion });
      }
    }

    if (versionsToUpdate.length > 0) {
      manifest.upstreamVersion = getUpstreamVersionTag(versionsToUpdate);
      writeManifest(manifest, { dir });
      writeCompose(compose, { dir });

      const commitMessage = `bump ${versionsToUpdate
        .map(({ repoSlug, newVersion }) => `${repoSlug} to ${newVersion}`)
        .join(", and ")}`;
      console.log(`commitMessage: ${commitMessage}`);

      if (!process.env.SKIP_COMMIT) {
        await shell(["git", "config", "user.name", userName]);
        await shell(["git", "config", "user.email", userEmail]);
        await shell(["git", "checkout", "-b", branch]);
        await shell(["git", "commit", "-a", "-m", commitMessage]);
        await shell(["git", "push", "-u", "origin", branchRef]);
        await thisRepo.openPR({
          from: branch,
          to: repoData.data.default_branch,
          title: commitMessage,
          body: getPrBody(versionsToUpdate)
        });
      }
    } else {
      console.log("All versions are up-to-date");
    }
  }
}
