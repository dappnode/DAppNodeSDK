import { Github } from "../../../../providers/github/Github.js";
import { pickLatestRelease } from "./pickLatestRelease.js";

export async function fetchGithubUpstreamVersion(
  repo: string
): Promise<string | null> {
  try {
    const newVersion = await fetchGithubLatestTag(repo);
    if (!newVersion) {
      console.log(
        `No stable release found (only drafts, pre-releases or release candidates) - ${repo}`
      );
      return null;
    }

    console.log(`Fetch latest version(s) - ${repo}: ${newVersion}`);
    return newVersion;
  } catch (e) {
    console.error("Error fetching upstream repo versions:", e);
    throw e;
  }
}

async function fetchGithubLatestTag(repo: string): Promise<string | null> {
  const [owner, repoName] = repo.split("/");
  const githubRepo = new Github({ owner, repo: repoName });

  const releases = await githubRepo.listReleases();
  if (releases.length === 0) throw Error(`No release found for ${repo}`);

  return pickLatestRelease(releases);
}
