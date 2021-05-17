import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types";
import { defaultDir } from "../../../params";
import { Github } from "../../../providers/github/Github";
import { getPrBody, getUpstreamVersionTag, VersionToUpdate } from "./format";
import { shell } from "../../../utils/shell";
import { readManifest, writeManifest } from "../../../utils/manifest";
import { readCompose, writeCompose } from "../../../utils/compose";
import { parseCsv } from "../../../utils/csv";
import { getLocalBranchExists, getGitHead } from "../../../utils/git";
import { arrIsUnique } from "../../../utils/array";
import { buildAndComment } from "../build";

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
  writeManifest(manifest, { dir });
  writeCompose(compose, { dir });

  const commitMsg = `bump ${versionsToUpdate
    .map(({ repoSlug, newVersion }) => `${repoSlug} to ${newVersion}`)
    .join(", ")}`;
  console.log(`commitMsg: ${commitMsg}`);

  console.log(await shell(`cat dappnode_package.json`));
  console.log(await shell(`cat docker-compose.yml`));

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await shell(`git config user.name ${userName}`);
  await shell(`git config user.email ${userEmail}`);
  await shell(`git checkout -b ${branch}`);

  // Check if there are changes
  console.log(await shell(`git status`));

  await shell(`git commit -a -m "${commitMsg}"`, { pipeToMain: true });
  await shell(`git push -u origin ${branchRef}`, { pipeToMain: true });
  await thisRepo.openPR({
    from: branch,
    to: repoData.data.default_branch,
    title: commitMsg,
    body: getPrBody(versionsToUpdate)
  });

  // get the list of branches of the repo
  const allBranches = await thisRepo.listBranches();

  // to obtain the url and other info of the new PR
  const newPr = await thisRepo.getOpenPrsFromBranch({ branch });
  const newPrUrl = newPr[0].html_url; // get the link of the new PR

  const bodyComment = `Closing for newer version for ${newPrUrl}`;

  // iterate the branches

  for (const branchToDelete of allBranches) {
    //check if there is any branch different to the new one and we collect the PR asociated too.
    try {
      if (
        // we filter the names: begin with prefix and the name of the last branch, the rest are old
        branchToDelete.name.startsWith(branchNameRoot) &&
        branchToDelete.name != branch
      ) {
        // obtain the pr's from the branch name
        const allPullRequests = await thisRepo.getOpenPrsFromBranch({
          branch: branchToDelete.name
        });

        // Iterate the PR's, comment them and close them

        for (const pr of allPullRequests) {
          try {
            // Comment the PR and close it
            const number = pr.number;
            await thisRepo.commentPullRequest({
              number: number,
              body: bodyComment
            });
            await thisRepo.closePR(number);
          } catch (e) {
            e.message = `Error Commenting and closing the PR: ${e.message}`;
          }
        }

        // Remove the old branch
        console.log(
          await shell(`git push origin --delete ${branchToDelete.name}`)
        );
      }
    } catch (e) {
      e.message = `Error deleting the branch: ${e.message}`;
      throw e;
    }
  }

  const gitHead = await getGitHead();
  await buildAndComment({ dir, commitSha: gitHead.commit, branch });
}
