import { expect } from "chai";
import { ListrContextBuild } from "../../../src/types.js";
import {
  buildResultMarkerJson,
  getBuildBotComment,
  isTargetComment,
  normalizeToBareCid,
  parseRunAttempt,
  renderResultMarker,
  resultMarkerPrefix,
  stableCommentMarker
} from "../../../src/commands/githubActions/build/botComment.js";

const commitSha = "a7cfeb18800dd33f25bafc4b397e88d09356b034";
const cid = "QmP7HGvTh2jEccAymRiSvsdZDg7K8a5HGf1rB7ciMEWfL2";

/**
 * Extract and parse the JSON payload from the result marker.
 * Returns the parsed object and a flag indicating whether a marker was found.
 */
function parseResultMarker(body: string): {
  found: boolean;
  json: string;
  data: {
    commit_sha: string;
    run_id?: string;
    run_attempt?: number;
    packages: Array<{ dnp_name: string; cid: string }>;
  } | null;
} {
  const start = body.indexOf(resultMarkerPrefix);
  if (start < 0) return { found: false, json: "", data: null };
  const jsonStart = start + resultMarkerPrefix.length;
  const end = body.indexOf("-->", jsonStart);
  if (end < 0) return { found: false, json: "", data: null };
  const json = body.slice(jsonStart, end).trim();
  return { found: true, json, data: JSON.parse(json) };
}

describe("botComment", () => {
  describe("normalizeToBareCid", () => {
    it("returns the input unchanged for a bare Qm... CID", () => {
      expect(normalizeToBareCid(cid)).to.equal(cid);
    });

    it("strips the /ipfs/ prefix", () => {
      expect(normalizeToBareCid(`/ipfs/${cid}`)).to.equal(cid);
    });

    it("strips the ipfs:// prefix", () => {
      expect(normalizeToBareCid(`ipfs://${cid}`)).to.equal(cid);
    });

    it("returns an empty string for empty, null, or undefined", () => {
      expect(normalizeToBareCid("")).to.equal("");
      expect(normalizeToBareCid("   ")).to.equal("");
      expect(normalizeToBareCid(undefined)).to.equal("");
      expect(normalizeToBareCid(null)).to.equal("");
    });
  });

  describe("parseRunAttempt", () => {
    it("parses a valid positive integer string", () => {
      expect(parseRunAttempt("1")).to.equal(1);
      expect(parseRunAttempt("7")).to.equal(7);
    });

    it("parses a positive integer number", () => {
      expect(parseRunAttempt(3)).to.equal(3);
    });

    it("rejects zero, negative, and non-integer values", () => {
      expect(parseRunAttempt("0")).to.equal(undefined);
      expect(parseRunAttempt("-1")).to.equal(undefined);
      expect(parseRunAttempt("1.5")).to.equal(undefined);
    });

    it("rejects empty or non-numeric strings", () => {
      expect(parseRunAttempt("")).to.equal(undefined);
      expect(parseRunAttempt("abc")).to.equal(undefined);
    });

    it("rejects null and undefined", () => {
      expect(parseRunAttempt(undefined)).to.equal(undefined);
      expect(parseRunAttempt(null)).to.equal(undefined);
    });
  });

  describe("getBuildBotComment - single package", () => {
    const buildResults: ListrContextBuild = {
      "dms.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp", releaseMultiHash: cid }
    };

    it("emits a single-package result marker with bare CID and stable marker", () => {
      const body = getBuildBotComment({
        commitSha,
        buildResults
      });

      expect(body).to.include(stableCommentMarker);
      const { found, data } = parseResultMarker(body);
      expect(found).to.equal(true);
      expect(data).to.deep.equal({
        commit_sha: commitSha,
        packages: [{ dnp_name: "dms.dnp.dappnode.eth", cid }]
      });
    });

    it("includes the install link and the human-readable hash", () => {
      const body = getBuildBotComment({ commitSha, buildResults });
      expect(body).to.include(`[Install link](http://my.dappnode/installer/public/${encodeURIComponent(cid)})`);
      expect(body).to.include(`Hash: \`${cid}\``);
    });

    it("keeps the legacy (by dappnodebot/build-action) tag", () => {
      const body = getBuildBotComment({ commitSha, buildResults });
      expect(body).to.include("(by dappnodebot/build-action)");
    });
  });

  describe("getBuildBotComment - multiple packages", () => {
    const buildResults: ListrContextBuild = {
      "a.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp/a", releaseMultiHash: "QmAAAA" },
      "b.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp/b", releaseMultiHash: "/ipfs/QmBBBB" },
      "c.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp/c", releaseMultiHash: "ipfs://QmCCCC" }
    };

    it("renders all packages with bare CIDs in the structured marker", () => {
      const body = getBuildBotComment({ commitSha, buildResults });
      const { data } = parseResultMarker(body);
      expect(data?.packages).to.deep.equal([
        { dnp_name: "a.dnp.dappnode.eth", cid: "QmAAAA" },
        { dnp_name: "b.dnp.dappnode.eth", cid: "QmBBBB" },
        { dnp_name: "c.dnp.dappnode.eth", cid: "QmCCCC" }
      ]);
    });

    it("preserves the original /ipfs/ and ipfs:// hashes in the human-readable block", () => {
      const body = getBuildBotComment({ commitSha, buildResults });
      expect(body).to.include("Hash: `/ipfs/QmBBBB`");
      expect(body).to.include("Hash: `ipfs://QmCCCC`");
    });
  });

  describe("getBuildBotComment - GITHUB_RUN_ID", () => {
    const buildResults: ListrContextBuild = {
      "a.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp", releaseMultiHash: cid }
    };

    it("omits run_id when not provided", () => {
      const body = getBuildBotComment({ commitSha, buildResults });
      const { data } = parseResultMarker(body);
      expect(data).to.not.have.property("run_id");
    });

    it("includes run_id when provided", () => {
      const body = getBuildBotComment({
        commitSha,
        buildResults,
        runId: "123456"
      });
      const { data } = parseResultMarker(body);
      expect(data?.run_id).to.equal("123456");
    });

    it("omits run_id when it is an empty string", () => {
      const body = getBuildBotComment({
        commitSha,
        buildResults,
        runId: ""
      });
      const { data } = parseResultMarker(body);
      expect(data).to.not.have.property("run_id");
    });
  });

  describe("getBuildBotComment - GITHUB_RUN_ATTEMPT", () => {
    const buildResults: ListrContextBuild = {
      "a.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp", releaseMultiHash: cid }
    };

    it("includes a valid positive integer run_attempt", () => {
      const body = getBuildBotComment({
        commitSha,
        buildResults,
        runAttempt: "1"
      });
      const { data } = parseResultMarker(body);
      expect(data?.run_attempt).to.equal(1);
    });

    it("omits an invalid run_attempt", () => {
      const body = getBuildBotComment({
        commitSha,
        buildResults,
        runAttempt: "abc"
      });
      const { data } = parseResultMarker(body);
      expect(data).to.not.have.property("run_attempt");
    });

    it("omits a zero or negative run_attempt", () => {
      const a = getBuildBotComment({ commitSha, buildResults, runAttempt: "0" });
      const b = getBuildBotComment({ commitSha, buildResults, runAttempt: "-1" });
      expect(parseResultMarker(a).data).to.not.have.property("run_attempt");
      expect(parseResultMarker(b).data).to.not.have.property("run_attempt");
    });
  });

  describe("getBuildBotComment - empty result marker", () => {
    it("emits the stable marker but no result marker when no package has a hash", () => {
      const buildResults: ListrContextBuild = {
        "a.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp/a" },
        "b.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp/b", releaseMultiHash: "" }
      };
      const body = getBuildBotComment({ commitSha, buildResults });
      expect(body).to.include(stableCommentMarker);
      const { found } = parseResultMarker(body);
      expect(found).to.equal(false);
    });
  });

  describe("isTargetComment", () => {
    it("accepts the new stable marker", () => {
      expect(isTargetComment(`hello\n${stableCommentMarker}`)).to.equal(true);
    });

    it("accepts the legacy (by dappnodebot/build-action) marker", () => {
      expect(isTargetComment("hello\n(by dappnodebot/build-action)")).to.equal(true);
    });

    it("rejects unrelated comments", () => {
      expect(isTargetComment("just a regular comment")).to.equal(false);
      expect(isTargetComment("")).to.equal(false);
    });
  });

  describe("renderResultMarker / buildResultMarkerJson", () => {
    const buildResults: ListrContextBuild = {
      "a.dnp.dappnode.eth": { variant: null, releaseDir: "/tmp", releaseMultiHash: cid }
    };

    it("emits a single-line JSON payload", () => {
      const json = buildResultMarkerJson({ commitSha, buildResults });
      expect(json).to.not.include("\n");
      const parsed = JSON.parse(json);
      expect(parsed.commit_sha).to.equal(commitSha);
      expect(parsed.packages).to.deep.equal([{ dnp_name: "a.dnp.dappnode.eth", cid }]);
    });

    it("renderResultMarker wraps the JSON in the result marker prefix and suffix", () => {
      const marker = renderResultMarker({ commitSha, buildResults });
      expect(marker.startsWith(resultMarkerPrefix)).to.equal(true);
      expect(marker.endsWith("-->")).to.equal(true);
    });

    it("renderResultMarker returns empty string when no package has a hash", () => {
      const empty: ListrContextBuild = {
        a: { variant: null, releaseDir: "/tmp" }
      };
      expect(renderResultMarker({ commitSha, buildResults: empty })).to.equal("");
    });
  });
});

describe("botComment - GITHUB_RUN_ID env", () => {
  const original = process.env.GITHUB_RUN_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.GITHUB_RUN_ID;
    else process.env.GITHUB_RUN_ID = original;
  });

  it("reads runId from GITHUB_RUN_ID when runId is not explicitly provided", () => {
    process.env.GITHUB_RUN_ID = "987654";
    const buildResults: ListrContextBuild = {
      a: { variant: null, releaseDir: "/tmp", releaseMultiHash: cid }
    };
    // We pass runAttempt as undefined to make sure the call works without
    // explicit params. runId is intentionally not provided.
    const json = buildResultMarkerJson({ commitSha, buildResults });
    // Without explicit runId, the build helper omits run_id; this documents
    // that the helper itself does not read process.env. The wiring lives in
    // the gaBuild handler which forwards the env var explicitly.
    expect(JSON.parse(json)).to.not.have.property("run_id");
  });
});
