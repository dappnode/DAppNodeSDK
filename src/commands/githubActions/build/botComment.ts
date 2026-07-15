import { ListrContextBuild } from "../../../types.js";
import { getInstallDnpLink } from "../../../utils/getLinks.js";

/**
 * Persistent tag used to identify the build bot comment in a PR.
 * Commented out from the readable body so it does not affect the user experience.
 */
export const stableCommentMarker = "<!-- dappnode-build-comment:v1 -->";

/**
 * Prefix of the structured result marker. The remainder of the line is a single
 * JSON payload terminated by `-->`.
 */
export const resultMarkerPrefix = "<!-- dappnode-build-result:v1 ";

/**
 * Suffix shared by both markers.
 */
const markerSuffix = " -->";

/**
 * Legacy human-readable signature kept during the migration period so that
 * existing comments are still recognized as the build bot comment and updated
 * in place rather than duplicated.
 */
const legacyBotCommentTag = "(by dappnodebot/build-action)";

/**
 * Schema of the JSON payload embedded in the result marker.
 * Keep stable: any breaking change requires bumping `:v1` to `:vN`.
 */
export interface BuildResultMarkerV1 {
  commit_sha: string;
  run_id?: string;
  run_attempt?: number;
  packages: Array<{
    dnp_name: string;
    cid: string;
  }>;
}

export interface GetBuildBotCommentParams {
  commitSha: string;
  buildResults: ListrContextBuild;
  /**
   * GitHub Actions run id. When undefined or empty the field is omitted.
   */
  runId?: string;
  /**
   * GitHub Actions run attempt. When not a positive integer the field is omitted.
   */
  runAttempt?: string | number;
}

/**
 * Constructs a comment summarizing build results for a specific commit.
 * The comment is human-readable and is also tagged with:
 *   - a stable `<!-- dappnode-build-comment:v1 -->` marker, and
 *   - a machine-readable `<!-- dappnode-build-result:v1 <JSON> -->` marker
 *     carrying a bare-CID payload for downstream consumers.
 *
 * The legacy `(by dappnodebot/build-action)` signature is preserved during the
 * migration period so that comments authored before this change are still
 * recognized as the build bot comment and updated in place.
 */
export function getBuildBotComment({
  commitSha,
  buildResults,
  runId,
  runAttempt
}: GetBuildBotCommentParams): string {
  const buildEntries = Object.entries(buildResults)
    .map(([dnpName, { releaseMultiHash }], index) => {
      if (releaseMultiHash)
        return formatBuildEntry({ dnpName, releaseMultiHash, index });
    })
    .join("\n\n");

  const resultMarker = renderResultMarker({
    commitSha,
    buildResults,
    runId,
    runAttempt
  });

  // Trailing newline is added so the result marker (when emitted) sits on its
  // own line, with the stable comment marker as the very last line.
  return `Dappnode bot has built and pinned the built packages to an IPFS node, for commit: ${commitSha}

This is a development version and should **only** be installed for testing purposes.

${buildEntries}

${legacyBotCommentTag}
${resultMarker}
${stableCommentMarker}
`;
}

function formatBuildEntry({
  dnpName,
  releaseMultiHash,
  index
}: {
  dnpName: string;
  releaseMultiHash: string;
  index: number;
}) {
  const installLink = getInstallDnpLink(releaseMultiHash);
  return `${index + 1}. Package **${dnpName}**

  [Install link](${installLink})

  Hash: \`${releaseMultiHash}\``;
}

/**
 * Build the JSON payload embedded in the result marker, normalized to bare CIDs.
 * Returns an empty string when there is no package with a non-empty hash, so
 * the caller can decide whether to emit the marker at all.
 */
export function buildResultMarkerJson({
  commitSha,
  buildResults,
  runId,
  runAttempt
}: GetBuildBotCommentParams): string {
  const packages: BuildResultMarkerV1["packages"] = [];
  for (const [dnpName, { releaseMultiHash }] of Object.entries(buildResults)) {
    if (!releaseMultiHash) continue;
    const cid = normalizeToBareCid(releaseMultiHash);
    if (!cid) continue;
    packages.push({ dnp_name: dnpName, cid });
  }

  if (packages.length === 0) return "";

  const payload: BuildResultMarkerV1 = { commit_sha: commitSha, packages };

  if (typeof runId === "string" && runId.trim() !== "")
    payload.run_id = runId;

  const attempt = parseRunAttempt(runAttempt);
  if (attempt !== undefined) payload.run_attempt = attempt;

  return JSON.stringify(payload);
}

/**
 * Render the full result marker line, or an empty string when no package has a
 * usable hash. The stable comment marker is always emitted separately so that
 * the comment is recognized as the build bot comment even when the result
 * payload is empty.
 */
export function renderResultMarker(
  params: GetBuildBotCommentParams
): string {
  const json = buildResultMarkerJson(params);
  if (!json) return "";
  // Defensive: collapse the JSON into a single line.
  const oneline = json.replace(/\s+/g, " ");
  return `${resultMarkerPrefix}${oneline}${markerSuffix}`;
}

/**
 * Strip the `ipfs://` and `/ipfs/` URL prefixes from a release hash so the
 * structured payload always carries a bare CID. Unknown shapes are returned
 * as-is when the value is a non-empty string.
 */
export function normalizeToBareCid(value: string | undefined | null): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("ipfs://")) return trimmed.slice("ipfs://".length);
  if (trimmed.startsWith("/ipfs/")) return trimmed.slice("/ipfs/".length);
  return trimmed;
}

/**
 * Parse `GITHUB_RUN_ATTEMPT` (or any string) into a positive integer run
 * attempt. Returns undefined when the value is not a positive integer.
 */
export function parseRunAttempt(
  value: string | number | undefined | null
): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (!Number.isInteger(n)) return undefined;
  if (n <= 0) return undefined;
  return n;
}

/**
 * Locates any existing comment by a persistent tag used in all build bot
 * comments. Returns true for both the new stable marker and the legacy
 * signature so that existing comments are updated in place instead of being
 * duplicated.
 */
export function isTargetComment(commentBody: string): boolean {
  if (!commentBody) return false;
  return (
    commentBody.includes(stableCommentMarker) ||
    commentBody.includes(legacyBotCommentTag)
  );
}
