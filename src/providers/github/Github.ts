import fs from "fs";
import path from "path";
import retry from "async-retry";
import mime from "mime-types";
import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
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
      const repoResponse = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      return repoResponse.data;
    } catch (e) {
      if (e instanceof RequestError && e.status === 404) {
        throw new Error(`Repo does not exist: ${this.repoSlug}`);
      }

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

    await this.octokit.rest.git.deleteRef({
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
      const matchingTags = await this.octokit.rest.git.listMatchingRefs({
        owner: this.owner,
        repo: this.repo,
        ref: `tags/${tag}`,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });

      if (matchingTags.data.length > 0) return true;

      return false;
    } catch (e) {
      e.message = `Error verifying tag ${tag}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Creates a Github tag at a given commit sha
   * @param tag "v0.2.0"
   * @param sha "ffac537e6cbbf934b08745a378932722df287a53"
   */
  async createTag(tag: string, sha: string): Promise<void> {
    try {
      await this.octokit.rest.git.createRef({
        owner: this.owner,
        repo: this.repo,
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
    return await this.octokit.rest.repos
      .listReleases({
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
          await this.octokit.rest.repos.deleteReleaseAsset({
            owner: this.owner,
            repo: this.repo,
            asset_id: asset.id,
            headers: {
              "X-GitHub-Api-Version": "2022-11-28"
            }
          });
        } catch (e) {
          e.message = `Error deleting release asset: ${e.message}`;
          throw e;
        }

      try {
        await this.octokit.rest.repos.deleteRelease({
          owner: this.owner,
          repo: this.repo,
          release_id: matchingRelease.id,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28"
          }
        });
      } catch (e) {
        e.message = `Error deleting release: ${e.message}`;
        throw e;
      }
    }
  }

  /**
   * Create a Github release and return the release id
   * @param tag "v0.2.0"
   * @param options
   */
  async createRelease(
    tag: string,
    options?: {
      body?: string;
      prerelease?: boolean;
    }
  ): Promise<number> {
    const { body, prerelease } = options || {};
    const release = await this.octokit.rest.repos
      .createRelease({
        owner: this.owner,
        repo: this.repo,
        tag_name: tag,
        name: this.buildReleaseNameFromTag(tag),
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

    return release.data.id;
  }

  async uploadReleaseAssets({
    releaseId,
    assetsDir,
    matchPattern,
    fileNamePrefix
  }: {
    releaseId: number;
    assetsDir: string;
    matchPattern?: RegExp;
    fileNamePrefix?: string;
  }) {
    for (const file of fs.readdirSync(assetsDir)) {
      // Used to ignore duplicated legacy .tar.xz image
      if (matchPattern && !matchPattern.test(file)) continue;

      const filepath = path.resolve(assetsDir, file);
      const contentType = mime.lookup(filepath) || "application/octet-stream";
      try {
        // The uploadReleaseAssetApi fails sometimes, retry 3 times
        await retry(
          async () => {
            await this.octokit.repos.uploadReleaseAsset({
              owner: this.owner,
              repo: this.repo,
              release_id: releaseId,
              data: fs.createReadStream(filepath) as any,
              headers: {
                "content-type": contentType,
                "content-length": fs.statSync(filepath).size
              },
              name: `${fileNamePrefix || ""}${path.basename(filepath)}`
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
   * Receives a tag and returns a prettified release name
   *
   * For single-variant packages:
   *  Tag: "v0.2.0" => Release name: "v0.2.0"
   *
   * For multi-variant packages:
   *  Tag: "gnosis@v0.1.2_holesky@v1.2.3_mainnet@v3.21.1" => Release name: "Gnosis(v0.1.2), Holesky(v1.2.3), Mainnet(v3.21.1)"
   *
   * @param tag
   */
  private buildReleaseNameFromTag(tag: string): string {
    const variants = tag.split("_").map(variant => {
      const [name, version] = variant.split("@");

      // If the variant is a single-variant package
      if (!version) return name;

      return `${name}(${version})`;
    });
    return variants.join(", ");
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
    await this.octokit.rest.pulls.create({
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
    const comments = await this.octokit.rest.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: number,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    const existingComment = comments.data.find(
      comment => comment.body && isTargetComment(comment.body)
    );

    if (existingComment) {
      await this.octokit.rest.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: existingComment.id,
        body,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
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
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: number,
      body,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
  }

  /**
   * Returns open PRs where head branch equals `branch`
   * Only branches and PRs originating from the same repo
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getOpenPrsFromBranch(branch: string) {
    const openPrsResponse = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: "open",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      },
      head: `${this.owner}:${branch}`
    });

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
    const branchesResponse = await this.octokit.rest.repos.listBranches({
      owner: this.owner,
      repo: this.repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    return branchesResponse.data;
  }

  /**
   * @param branch "octocat-patch-1"
   */
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async getBranch(branch: string) {
    const branchResponse = await this.octokit.rest.repos.getBranch({
      owner: this.owner,
      repo: this.repo,
      branch,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
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
      if (e instanceof RequestError && e.status === 404) return false;

      e.message = `Error verifying branch ${branch}: ${e.message}`;
      throw e;
    }
  }

  /**
   * Close a PR
   */

  async closePR(pull_number: number): Promise<void> {
    try {
      await this.octokit.rest.pulls.update({
        owner: this.owner,
        repo: this.repo,
        pull_number,
        state: "closed",
        headers: {
          "X-GitHub-Api-Version": "2022-11-28"
        }
      });
    } catch (e) {
      e.message = `Error closing PR: ${e.message}`;
      throw e;
    }
  }
}
