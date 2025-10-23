import { Github } from "../../../../providers/github/Github.js";
import { isValidRelease } from "./isValidRelease.js";
import { components } from '@octokit/openapi-types';

type Release = components["schemas"]["release"];
export async function fetchGithubUpstreamVersion(
  repo: string
): Promise<string | null> {
  try {
    const newVersion = await fetchGithubLatestTag(repo);
    if (!isValidRelease(newVersion)) {
      console.log(
        `This is not a valid release (probably a release candidate) - ${repo}: ${newVersion.tag_name}`
      );
      return null;
    }

    console.log(`Fetch latest version(s) - ${repo}: ${newVersion.tag_name}`);
    return newVersion.tag_name;
  } catch (e) {
    console.error("Error fetching upstream repo versions:", e);
    throw e;
  }
}

async function fetchGithubLatestTag(repo: string): Promise<Release> {
  const [owner, repoName] = repo.split("/");
  const githubRepo = new Github({ owner, repo: repoName });

  const releases = await githubRepo.listReleases();

  // Check if is empty
  if (!releases || releases.length === 0) {
    throw Error(`No releases found for ${repo}`);
  }

  // Filter out draft and prerelease
  const validReleases = releases.filter(
    release => !release.draft && !release.prerelease
  );
  if (validReleases.length === 0) {
    throw Error(`No valid releases found for ${repo}`);
  }

  const latestRelease = validReleases[0];

  return latestRelease;
}
