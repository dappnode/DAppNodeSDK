import { Github } from "../../../../providers/github/Github.js";
import { isValidRelease } from "./isValidRelease.js";

export async function fetchGithubUpstreamVersion(repo: string): Promise<string | null> {

    try {

        const newVersion = await fetchGithubLatestTag(repo);
        if (!isValidRelease(newVersion)) {
            console.log(`This is not a valid release (probably a release candidate) - ${repo}: ${newVersion}`);
            return null;
        }

        console.log(`Fetch latest version(s) - ${repo}: ${newVersion}`);
        return newVersion;
    } catch (e) {
        console.error("Error fetching upstream repo versions:", e);
        throw e;
    }
}

async function fetchGithubLatestTag(repo: string): Promise<string> {
    const [owner, repoName] = repo.split("/");
    const githubRepo = new Github({ owner, repo: repoName });

    const releases = await githubRepo.listReleases();
    const latestRelease = releases[0];
    if (!latestRelease) throw Error(`No release found for ${repo}`);

    return latestRelease.tag_name;

}