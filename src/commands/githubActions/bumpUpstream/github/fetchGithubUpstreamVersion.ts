import semver from "semver";
import { Github } from "../../../../providers/github/Github.js";
import { isValidRelease } from "./isValidRelease.js";

export async function fetchGithubUpstreamVersion(
  repo: string
): Promise<string | null> {
  try {
    const newVersion = await fetchGithubLatestTag(repo);
    if (!newVersion) {
      console.log(
        `No valid release found (probably all are release candidates) - ${repo}`
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

  if (!releases?.length) {
    throw Error(`No releases found for ${repo}`);
  }

  // Filter valid releases: not draft, not prerelease, passes semver validation
  const validReleases = releases.filter(
    release =>
      !release.draft && !release.prerelease && isValidRelease(release.tag_name)
  );

  if (validReleases.length === 0) {
    return null;
  }

  // Sort by semver descending to get the highest version
  validReleases.sort((a, b) => {
    const versionA = semver.coerce(a.tag_name);
    const versionB = semver.coerce(b.tag_name);
    if (!versionA || !versionB) return 0;
    return semver.rcompare(versionA, versionB);
  });

  return validReleases[0].tag_name;
}
