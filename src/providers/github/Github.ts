import fs from "fs";
import path from "path";
import mime from "mime-types";
import retry from "async-retry";
import { Octokit } from "@octokit/rest";
import { getRepoSlugFromManifest } from "../../files/index.js";

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
      const repoResponse = await this.octokit.request(
        "GET /repos/{owner}/{repo}",
        {
          owner: this.owner,
          repo: this.repo,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28"
          }
        }
      );

      return repoResponse.data;
    } catch (e) {
      if (e.status === 404 || e.status === "404")
        throw Error(`Repo does not exist: ${this.repoSlug}`);
      e.message = `Error verifying repo ${this.repoSlug}: ${e.message}`;
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
    if (!(await this.tagExists(tag))) return;

    await this.octokit.request("DELETE /repos/{owner}/{repo}/git/refs/{ref}", {
      owner: this.owner,
      repo: this.repo,
      ref: `tags/${tag}`,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
  }

  private async tagExists(tag: string): Promise<boolean> {
    try {
      await this.octokit.request("GET /repos/{owner}/{repo}/git/ref/{ref}", {
        owner: this.owner,
        repo: this.repo,
        ref: `tags/${tag}`,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
      return true;
    } catch (e) {
      if (e.status === 404 || e.status === "404") return false;
      else throw e;
    }
  }

  /**
   * Creates a Github tag at a given commit sha
   * @param tag "v0.2.0"
   * @param sha "ffac537e6cbbf934b08745a378932722df287a53"
   */
  async createTag(tag: string, sha: string): Promise<void> {
    try {
      await this.octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner: this.owner,
        repo: "DAppNodePackage-SSV-holesky",
        ref: `refs/tags/${tag}`,
        sha,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
    } catch (e) {
      e.message = `Error creating tag ${tag} at ${sha}: ${e.message}`;
      throw e;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async listReleases() {
    return await this.octokit
      .request("GET /repos/{owner}/{repo}/releases", {
        owner: this.owner,
        repo: this.repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
      .then(res => res.data);
  }

  /**
   * Removes all Github releases that match a tag, and its assets
   * If there are no releases, repos.listReleases will return []
   * @param tag "v0.2.0"
   */
  async deleteReleaseAndAssets(tag: string): Promise<void> {
    const releases = await this.listReleases();
    const matchingReleases = releases.filter(
      ({ tag_name, name }) => tag_name === tag || name === tag
    );

    for (const matchingRelease of matchingReleases) {
      for (const asset of matchingRelease.assets)
        try {
          await this.octokit.request(
            "DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}",
            {
              owner: this.owner,
              repo: this.repo,
              asset_id: asset.id,
              headers: {
                "X-GitHub-Api-Version": "2022-11-28"
              }
            }
          );
        } catch (e) {
          e.message = `Error deleting release asset: ${e.message}`;
          throw e;
        }

      try {
        await this.octokit.request(
          "DELETE /repos/{owner}/{repo}/releases/{release_id}",
          {
            owner: this.owner,
            repo: this.repo,
            release_id: matchingRelease.id,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28"
            }
          }
        );
      } catch (e) {
        e.message = `Error deleting release: ${e.message}`;
        throw e;
      }
    }
  }

  /**
   * Create a Github release
   * @param tag "v0.2.0"
   * @param options
   */
  async createRelease(
    tag: string,
    options?: {
      body?: string;
      prerelease?: boolean;
    }
  ): Promise<void> {
    const { body, prerelease } = options || {};
    await this.octokit
      .request("POST /repos/{owner}/{repo}/releases", {
        owner: this.owner,
        repo: this.repo,
        tag_name: tag,
        name: tag,
        body,
        prerelease,
        generate_release_notes: true,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      })
      .catch(e => {
        e.message = `Error creating release: ${e.message}`;
        throw e;
      });
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
    await this.octokit.request("POST /repos/{owner}/{repo}/pulls", {
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: from,
      base: to,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
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
    const comments = await this.octokit.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    const existingComment = comments.data.find(
      comment => comment.body && isTargetComment(comment.body)
    );

    if (existingComment) {
      await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: this.owner,
          repo: this.repo,
          comment_id: existingComment.id,
          body,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28"
          }
        }
      );
    } else {
      this.createCommentInPr({ number, body });
    }
  }

  /**
   * Comment a Pull Request
   */
  async createCommentInPr({
    number,
    body
  }: {
    number: number;
    body: string;
  }): Promise<void> {
    await this.octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: number,
        body,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
  }

  /**
   * Returns open PRs where head branch equals `branch`
   * Only branches and PRs originating from the same repo
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getOpenPrsFromBranch(branch: string) {
    const openPrsResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls",
      {
        owner: this.owner,
        repo: this.repo,
        state: "open",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        },
        head: `${this.owner}:${branch}`
      }
    );

    return openPrsResponse.data;
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
    const branchesResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/branches",
      {
        owner: this.owner,
        repo: this.repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    return branchesResponse.data;
  }

  /**
   * @param branch "octocat-patch-1"
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getBranch(branch: string) {
    const branchResponse = await this.octokit.request(
      "GET /repos/{owner}/{repo}/branches/{branch}",
      {
        owner: this.owner,
        repo: this.repo,
        branch,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    return branchResponse.data;
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
      if (e.status === 404 || e.status === "404") return false;
      else throw e;
    }
  }

  /**
   * Close a PR
   */

  async closePR(pull_number: number): Promise<void> {
    try {
      await this.octokit.request(
        "PATCH /repos/{owner}/{repo}/pulls/{pull_number}",
        {
          owner: this.owner,
          repo: this.repo,
          pull_number,
          state: "closed",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28"
          }
        }
      );
    } catch (e) {
      e.message = `Error closing PR: ${e.message}`;
      throw e;
    }
  }
}
