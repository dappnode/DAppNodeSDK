import { expect } from "chai";
import { Github } from "../../../src/providers/github/Github.js";

/**
 * These tests exercise the `commentToPr` create-path of `Github` without a
 * broad refactor. We construct a real `Github` instance (which needs
 * `GITHUB_TOKEN`) and then replace its private `octokit` with a minimal stub
 * that records the calls and resolves immediately. The goal is to assert that
 * the create path is awaited, not to verify the entire Octokit surface.
 */
describe("Github.commentToPr - create path is awaited", () => {
  const originalToken = process.env.GITHUB_TOKEN;
  let github: Github;
  let createCommentCalls: number;
  let createCommentDelayMs: number;
  let listCommentsCalls: number;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    createCommentCalls = 0;
    createCommentDelayMs = 25;
    listCommentsCalls = 0;

    github = new Github({ owner: "acme", repo: "widget" });

    const stub = {
      rest: {
        issues: {
          listComments: async () => {
            listCommentsCalls += 1;
            return { data: [] };
          },
          createComment: async (args: unknown) => {
            createCommentCalls += 1;
            // Simulate a slow request. If `commentToPr` did NOT await the
            // call, the assertion below would observe a dangling, un-awaited
            // promise and the test would flake.
            await new Promise(resolve => setTimeout(resolve, createCommentDelayMs));
            return { data: { id: 1, body: (args as { body: string }).body } };
          },
          updateComment: async () => ({ data: { id: 1 } })
        }
      }
    };

    // Inject the stub into the private field.
    (github as unknown as { octokit: unknown }).octokit = stub;
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
  });

  it("awaits createCommentInPr on the create path", async () => {
    const body = "hello <!-- dappnode-build-comment:v1 -->";
    const start = Date.now();
    await github.commentToPr({
      number: 7,
      body,
      isTargetComment: () => false
    });
    const elapsed = Date.now() - start;

    expect(listCommentsCalls).to.equal(1);
    expect(createCommentCalls).to.equal(1);
    // If the call is not awaited, the elapsed time will be far below the
    // simulated request delay.
    expect(elapsed).to.be.gte(createCommentDelayMs);
  });
});
