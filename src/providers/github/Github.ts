import fs from "fs";
import path from "path";
import mime from "mime-types";
import retry from "async-retry";
import { Octokit } from "@octokit/rest";
import { getRepoSlugFromManifest } from "../../utils/manifest";

export class Github {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor({ owner, repo }: { owner: string; repo: string }) {
    this.owner = owner;
    this.repo = repo;

    // OAuth2 token from Github
    if (!process.env.GITHUB_TOKEN)
      throw Error("GITHUB_TOKEN ENV (OAuth2) is required");
    this.octokit = new Octokit({
      auth: `token ${process.env.GITHUB_TOKEN}`
    });
  }

  static fromLocal(dir: string): Github {
    const repoSlug =
      process.env.GITHUB_REPOSITORY ||
      process.env.TRAVIS_REPO_SLUG ||
      getRepoSlugFromManifest({ dir });

    if (!repoSlug)
      throw Error(
        "manifest.repository must be properly defined to create a Github release"
      );

    const [owner, repo] = repoSlug.split("/");

    if (!owner) throw Error(`repoSlug "${repoSlug}" hasn't an owner`);
    if (!repo) throw Error(`repoSlug "${repoSlug}" hasn't a repo`);

    return new Github({ owner, repo });
  }

  get repoSlug(): string {
    return `${this.owner}/${this.repo}`;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getRepo() {
    try {
      return await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo
      });
    } catch (e) {
      const repoSlug = `${this.owner}/${this.repo}`;
      if (e.status === 404) throw Error(`Repo does not exist: ${repoSlug}`);
      e.message = `Error verifying repo ${repoSlug}: ${e.message}`;
      throw e;
    }
  }

  async assertRepoExists(): Promise<void> {
    await this.getRepo();
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

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async listReleases() {
    return await this.octokit.repos
      .listReleases({ owner: this.owner, repo: this.repo })
      .then(res => res.data);
  }

  /**
   * Removes all Github releases that match a tag, and it's assets
   * @param tag "v0.2.0"
   */
  async deteleReleaseAndAssets(tag: string): Promise<void> {
    const releases = await this.listReleases();
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
    title,
    body
  }: {
    from: string;
    to: string;
    title: string;
    body?: string;
  }): Promise<void> {
    await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
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
   * @param number Pull Request number #45
   */
  async commentToPr({
    number,
    body,
    isTargetComment
  }: {
    number: number;
    body: string;
    isTargetComment: (commentBody: string) => boolean;
  }): Promise<void> {
    const comments = await this.octokit.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: number
    });

    const existingComment = comments.data.find(
      comment => comment.body && isTargetComment(comment.body)
    );

    if (existingComment) {
      await this.octokit.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        comment_id: existingComment.id,
        body
      });
    } else {
      await this.octokit.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        body
      });
    }
  }

  /**
   * Comment a Pull Request
   */
  async commentPullRequest({
    number,
    body
  }: {
    number: number;
    body: string;
  }): Promise<void> {
    await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: number,
      body
    });
  }

  /**
   * Returns open PRs where head branch equals `branch`
   * Only branches and PRs originating from the same repo
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getOpenPrsFromBranch({ branch }: { branch: string }) {
    const res = await this.octokit.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: "open",
      // example: "dappnode:dapplion/test-builds"
      head: `${this.owner}:${branch}`
    });
    return res.data;
  }

  /**
   * Returns list of branches, limited to 100. For more implement pagination
   * @returns branch = {
   *   name: "octocat-patch-1"
   *   commit: {
   *     sha: "b1b3f9723831141a31a1a7252a213e216ea76e56"
   *   }
   * }
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async listBranches() {
    const res = await this.octokit.repos.listBranches({
      owner: this.owner,
      repo: this.repo
    });
    return res.data;
  }

  /**
   * @param branch "octocat-patch-1"
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getBranch(branch: string) {
    const res = await this.octokit.repos.getBranch({
      owner: this.owner,
      repo: this.repo,
      branch
    });
    return res.data;
  }

  /**
   * Returns true if the branch exists, false if it does not, error otherwise
   * @param branch "octocat-patch-1"
   */
  async branchExists(branch: string): Promise<boolean> {
    try {
      const data = await this.getBranch(branch);
      return Boolean(data);
    } catch (e) {
      if (e.status === 404) return false;
      else throw e;
    }
  }

  /**
   * Close a PR
   */

  async closePR(pull_number: number): Promise<void> {
    try {
      this.octokit.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number,
        state: "closed"
      });
    } catch (e) {
      e.message = `Error closing PR: ${e.message}`;
      throw e;
    }
  }
}
