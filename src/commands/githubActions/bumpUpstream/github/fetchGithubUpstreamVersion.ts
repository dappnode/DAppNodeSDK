import { Github } from "../../../../providers/github/Github.js";
import { selectLatestRelease } from "./pickLatestRelease.js";

export async function fetchGithubUpstreamVersion(
  repo: string,
  tagPattern?: string
): Promise<string | null> {
  try {
    const newVersion = await fetchGithubLatestTag(repo, tagPattern);
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

async function fetchGithubLatestTag(
  repo: string,
  tagPattern?: string
): Promise<string | null> {
  const [owner, repoName] = repo.split("/");
  const githubRepo = new Github({ owner, repo: repoName });

  return selectLatestRelease(
    await githubRepo.getLatestRelease(),
    async () => {
      // Release bodies make pages of 100 several MB; 30 recent releases suffice.
      const releases = await githubRepo.listReleases(30);
      if (releases.length === 0) throw Error(`No release found for ${repo}`);
      return releases;
    },
    tagPattern
  );
}
