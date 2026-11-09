import fs from "fs";
import path from "path";
import { mock } from "node:test";
import { expect } from "chai";
import { Github } from "../../../src/providers/github/Github.js";
import { temporaryDirectory } from "../../helpers/fixtures.js";

const alreadyExists = Object.assign(new Error("Validation Failed"), {
  status: 422,
  response: {
    data: { errors: [{ resource: "ReleaseAsset", code: "already_exists" }] }
  }
});

function githubWith(octokit: unknown): Github {
  const original = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "fake";
  const github = new Github({ owner: "dappnode", repo: "demo" });
  if (original === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = original;
  (github as unknown as { octokit: unknown }).octokit = octokit;
  return github;
}

describe("idempotent GitHub release asset upload", function () {
  this.timeout(30000); // async-retry backs off ~7s across its 3 retries
  let dir: string;
  beforeEach(() => {
    dir = temporaryDirectory();
    fs.writeFileSync(path.join(dir, "image.txz"), "12345");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("accepts an asset a failed attempt already stored completely", async () => {
    let posts = 0;
    const github = githubWith({
      request: async () => {
        posts++;
        throw alreadyExists;
      },
      paginate: async () => [
        { id: 7, name: "image.txz", size: 5, state: "uploaded" }
      ],
      rest: { repos: { listReleaseAssets: {}, deleteReleaseAsset: {} } }
    });
    await github.uploadReleaseAssets({ releaseId: 1, assetsDir: dir });
    expect(posts).to.equal(1);
  });

  it("replaces a partial asset and uploads again", async () => {
    const calls: string[] = [];
    const github = githubWith({
      request: async () => {
        calls.push("post");
        if (calls.filter(call => call === "post").length === 1)
          throw alreadyExists;
      },
      paginate: async () => [
        { id: 7, name: "image.txz", size: 2, state: "uploaded" }
      ],
      rest: {
        repos: {
          listReleaseAssets: {},
          deleteReleaseAsset: async ({ asset_id }: { asset_id: number }) => {
            calls.push(`delete:${asset_id}`);
          }
        }
      }
    });
    await github.uploadReleaseAssets({ releaseId: 1, assetsDir: dir });
    expect(calls).to.deep.equal(["post", "delete:7", "post"]);
  });

  it("closes the file stream of every attempt, including failed ones", async () => {
    const streams: fs.ReadStream[] = [];
    const original = fs.createReadStream;
    mock.method(
      fs,
      "createReadStream",
      (...args: Parameters<typeof original>) => {
        const stream = original(...args);
        streams.push(stream);
        return stream;
      }
    );
    let posts = 0;
    const github = githubWith({
      request: async () => {
        if (++posts === 1)
          throw Object.assign(new Error("reset"), { status: 502 });
      }
    });
    try {
      await github.uploadReleaseAssets({ releaseId: 1, assetsDir: dir });
    } finally {
      mock.restoreAll();
    }
    expect(streams).to.have.length(2);
    expect(streams.every(stream => stream.destroyed)).to.equal(true);
    // Removing the file while a stream of a failed attempt is still opening must not crash.
    fs.rmSync(dir, { recursive: true, force: true });
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  it("still fails on other errors", async () => {
    const github = githubWith({
      request: async () => {
        throw Object.assign(new Error("Bad credentials"), { status: 401 });
      }
    });
    const error = await github
      .uploadReleaseAssets({ releaseId: 1, assetsDir: dir })
      .catch(error => error);
    expect(error.message).to.include("Bad credentials");
  });
});
