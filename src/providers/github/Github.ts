import fs from "fs";
import path from "path";
import mime from "mime-types";
import retry from "async-retry";
import { Octokit } from "@octokit/rest";
import { getRepoSlugFromManifest } from "../../utils/getRepoSlugFromManifest";

export class Github {
  octokit: Octokit;
  owner: string;
  repo: string;
  repoSlug: string;

  constructor(dir: string) {
    const repoSlug =
      getRepoSlugFromManifest(dir) ||
      process.env.TRAVIS_REPO_SLUG ||
      process.env.GITHUB_REPOSITORY;

    if (!repoSlug)
      throw Error(
        "manifest.repository must be properly defined to create a Github release"
      );

    const [owner, repo] = repoSlug.split("/");

    if (!owner) throw Error(`repoSlug "${repoSlug}" hasn't an owner`);
    if (!repo) throw Error(`repoSlug "${repoSlug}" hasn't a repo`);

    this.owner = owner;
    this.repo = repo;
    this.repoSlug = repoSlug;

    // OAuth2 token from Github
    if (!process.env.GITHUB_TOKEN)
      throw Error("GITHUB_TOKEN ENV (OAuth2) is required");
    this.octokit = new Octokit({
      auth: `token ${process.env.GITHUB_TOKEN}`
    });
  }

  async assertRepoExists(): Promise<void> {
    try {
      await this.octokit.repos.get({ owner: this.owner, repo: this.repo });
    } catch (e) {
      if (e.status === 404)
        throw Error(
          `Repo does not exist: ${this.repoSlug}. Check the manifest.repository object and correct the repo URL`
        );
      e.message = `Error verifying repo ${this.repoSlug}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Deletes a tag only if exists, does not throw on 404
   * @param tag "v0.2.0", "release/patch"
   */
  async deleteTagIfExists(tag: string): Promise<void> {
    try {
      await this.octokit.git.deleteRef({
        owner: this.owner,
        repo: this.repo,
        ref: `tags/${tag}`
      });
    } catch (e) {
      // Ignore error if the reference does not exist, can be deleted latter
      if (!e.message.includes("Reference does not exist")) {
        e.message = `Error deleting tag ${tag}: ${e.message}`;
        throw e;
      }
    }
  }

  /**
   * Creates a Github tag at a given commit sha
   * @param tag "v0.2.0"
   * @param sha "ffac537e6cbbf934b08745a378932722df287a53"
   */
  async createTag(tag: string, sha: string): Promise<void> {
    try {
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/tags/${tag}`,
        sha
      });
    } catch (e) {
      e.message = `Error creating tag ${tag} at ${sha}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Removes all Github releases that match a tag, and it's assets
   * @param tag "v0.2.0"
   */
  async deteleReleaseAndAssets(tag: string): Promise<void> {
    const releases = await this.octokit.repos
      .listReleases({ owner: this.owner, repo: this.repo })
      .then(res => res.data);
    const matchingReleases = releases.filter(
      ({ tag_name, name }) => tag_name === tag || name === tag
    );

    for (const matchingRelease of matchingReleases) {
      for (const asset of matchingRelease.assets)
        try {
          await this.octokit.repos.deleteReleaseAsset({
            owner: this.owner,
            repo: this.repo,
            asset_id: asset.id
          });
        } catch (e) {
          e.message = `Error deleting release asset: ${e.message}`;
          throw e;
        }

      try {
        await this.octokit.repos.deleteRelease({
          owner: this.owner,
          repo: this.repo,
          release_id: matchingRelease.id
        });
      } catch (e) {
        e.message = `Error deleting release: ${e.message}`;
        throw e;
      }
    }
  }

  /**
   * Create a Github release
   * - With `assetsDir`, all its files will be uploaded as release assets
   * @param tag "v0.2.0"
   * @param options
   */
  async createReleaseAndUploadAssets(
    tag: string,
    options?: {
      body?: string;
      prerelease?: boolean;
      assetsDir?: string;
      ignorePattern?: RegExp;
    }
  ): Promise<void> {
    const { body, prerelease, assetsDir, ignorePattern } = options || {};
    const release = await this.octokit.repos
      .createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: tag,
        name: tag,
        body,
        prerelease
      })
      .catch(e => {
        e.message = `Error creating release: ${e.message}`;
        throw e;
      });

    if (assetsDir)
      for (const file of fs.readdirSync(assetsDir)) {
        // Used to ignore duplicated legacy .tar.xz image
        if (ignorePattern && ignorePattern.test(file)) continue;

        const filepath = path.resolve(assetsDir, file);
        const contentType = mime.lookup(filepath) || "application/octet-stream";
        try {
          // The uploadReleaseAssetApi fails sometimes, retry 3 times
          await retry(
            async () => {
              await this.octokit.repos.uploadReleaseAsset({
                owner: this.owner,
                repo: this.repo,
                release_id: release.data.id,
                data: fs.createReadStream(filepath) as any,
                headers: {
                  "content-type": contentType,
                  "content-length": fs.statSync(filepath).size
                },
                name: path.basename(filepath)
              });
            },
            { retries: 3 }
          );
        } catch (e) {
          e.message = `Error uploading release asset: ${e.message}`;
          throw e;
        }
      }
  }

  /**
   * Open a Github pull request
   */
  async openPR({
    from,
    to,
    title
  }: {
    from: string;
    to: string;
    title: string;
  }): Promise<void> {
    await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      head: from,
      base: to
    });
  }

  /**
   * In a Github Actions context, get the pull request number of this run
   */
  getPullRequestNumber(): number {
    if (!process.env.GITHUB_EVENT_PATH) {
      throw Error("ENV GITHUB_EVENT_PATH is not defined");
    }
    const eventData = JSON.parse(
      fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
    );
    return eventData.pull_request.number;
  }

  /**
   * Create or update a comment in a Github PR according to `isTargetComment()`
   */
  async commentToPr({
    pullRequestNumber,
    body,
    isTargetComment
  }: {
    pullRequestNumber: number;
    body: string;
    isTargetComment: (commentBody: string) => boolean;
  }): Promise<void> {
    const comments = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: pullRequestNumber
    });

    const existingComment = comments.data.find(
      comment => comment.body && isTargetComment(comment.body)
    );

    if (existingComment) {
      await this.octokit.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: pullRequestNumber,
        comment_id: existingComment.id,
        body
      });
    } else {
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: pullRequestNumber,
        body
      });
    }
  }
}

export function getPullRequestNumberIfInAction(): number | null {
  if (process.env.GITHUB_EVENT_PATH) {
    const eventData = JSON.parse(
      fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
    );
    return eventData.pull_request.number;
  }
  return null;
}
