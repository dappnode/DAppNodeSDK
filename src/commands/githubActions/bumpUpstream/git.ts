import semver from "semver";
import { branchNameRoot } from "../../../params.js";
import { Github } from "../../../providers/github/Github.js";
import { shell } from "../../../utils/shell.js";
import { GitBranch, GithubSettings, UpstreamRepoMap, ComposeVersionsToUpdate } from "./types.js";
import { getLocalBranchExists } from "../../../utils/git.js";

/**
 * We only want one `bump-upstream` PR to be open since we likely
 * want to always merge to the latest version. This step lists all
 * PRs that start with the tag `branchNameRoot` and closes all but `branch`
 */
export async function closeOldPrs(
    thisRepo: Github,
    newBranch: string
): Promise<void> {
    // Get the url of the just opened PR for this branch
    const [newPr] = await thisRepo.getOpenPrsFromBranch({ branch: newBranch });
    if (!newPr)
        throw Error(`No PR found for branch ${newBranch}`);

    const allBranches = await thisRepo.listBranches();

    const bumpBranches = allBranches.filter(({ name }) => name.startsWith(branchNameRoot) && name !== newBranch);

    for (const { name: oldBranch } of bumpBranches) {

        try {

            const prs = await thisRepo.getOpenPrsFromBranch({ branch: oldBranch });

            for (const pr of prs) {
                try {
                    // Comment the PR and close it
                    await thisRepo.commentPullRequest({
                        number: pr.number,
                        body: `Newer version available, closing for ${newPr.html_url}`
                    });
                    await thisRepo.closePR(pr.number);
                    console.log(`Closed PR #${pr.number} and commented: 'Newer version available, closing for ${newPr.html_url}'`);
                } catch (e) {
                    console.error(`Error commenting and closing PR ${pr.number}`, e);
                }
            }

            // Remove the old branch
            await shell(`git push origin --delete ${oldBranch}`);
            console.log(`Deleted branch: ${oldBranch}`);

        } catch (e) {
            console.error(`Error deleting branch ${oldBranch}`, e);
        }
    }
}

export function getPrBody(versionsToUpdate: ComposeVersionsToUpdate): string {
    return [
        "Bumps upstream version",
        Object.entries(versionsToUpdate)
            .map(([repoSlug, { newVersion, currentVersion }]) =>
                `- [${repoSlug}](${getGitHubUrl({ repoSlug })}) from ${currentVersion} to [${newVersion}](${getGitHubUrl({ repoSlug, tag: newVersion })})`
            )
            .join("\n")
    ].join("\n\n");
}

function getGitHubUrl({ repoSlug, tag = "" }: { repoSlug: string, tag?: string }): string {
    const baseUrl = `https://github.com/${repoSlug}`;
    return tag ? `${baseUrl}/releases/tag/${tag}` : baseUrl;
}

// https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0
export function getUpstreamVersionTag(versionsToUpdate: ComposeVersionsToUpdate): string {
    const entries = Object.entries(versionsToUpdate);

    if (entries.length === 1) {
        const [{ newVersion }] = Object.values(versionsToUpdate);
        return newVersion;
    } else {
        return entries
            .map(([repoSlug, { newVersion }]) => `${repoSlug}@${newVersion}`)
            .join(", ");
    }
}

export function isValidRelease(version: string): boolean {
    // Nightly builds are not considered valid releases (not taken into account by semver)
    if (version.includes("nightly")) return false;

    if (!semver.valid(version)) return false;

    const preReleases = semver.prerelease(version);

    // A version is considered a valid release if it has no pre-release components.
    return preReleases === null || preReleases.length === 0;
}

export function getBranch(upstreamVersions: UpstreamRepoMap): GitBranch {
    const branchName = branchNameRoot +
        Array.from(Object.values(upstreamVersions))
            .map(({ repo, newVersion }) => `${repo}@${newVersion}`)
            .join(",");
    const branchRef = `refs/heads/${branchName}`;

    return { branchName, branchRef };
}

export async function getGitHubSettings(dir: string, upstreamVersions: UpstreamRepoMap): Promise<GithubSettings> {
    const thisRepo = Github.fromLocal(dir);
    const repoData = await thisRepo.getRepo();
    const branch = getBranch(upstreamVersions);
    return { repo: thisRepo, repoData, ...branch };
}

export async function isBranchNew({ branchName, repo }: { branchName: string, repo: Github }): Promise<boolean> {
    const [remoteBranchExists, localBranchExists] = await Promise.all([
        repo.branchExists(branchName),
        getLocalBranchExists(branchName),
    ]);

    return !remoteBranchExists && !localBranchExists;
}