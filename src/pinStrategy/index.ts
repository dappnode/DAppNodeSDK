import { PinataMetadata } from "../releaseUploader/pinata/index.js";
import { PinataPinManager } from "../providers/pinata/pinManager.js";
import { GitHead } from "../utils/git.js";
import { shell } from "../utils/shell.js";
import { prettyPinataPinName } from "../utils/format.js";
import { DnpPinMetadata, PinDataSummary, PinsByBranch } from "./types.js";
import { groupPinsByBranch } from "./utils.js";
import { Manifest } from "@dappnode/types";

// This file has all logic for the pin strategy of DAppNode packages
// In development, builds will be uploaded on each push on a PR
// only the latest commit of each branch will stay pinned.
//
// When PR is merged (and the branch is deleted) all pins associated to
// that branch will be unpinned

export function getPinMetadata(
  manifest: Manifest,
  gitHead?: GitHead
): PinataMetadata<DnpPinMetadata> {
  const upstreamVersion = Array.isArray(manifest.upstreamVersion)
    ? manifest.upstreamVersion.join(", ")
    : manifest.upstreamVersion;

  return {
    name: prettyPinataPinName(manifest, gitHead),
    keyvalues: {
      dnpName: manifest.name,
      version: manifest.version,
      upstreamVersion: upstreamVersion,
      commit: gitHead ? gitHead.commit : undefined,
      branch: gitHead ? gitHead.branch : undefined
    }
  };
}

/**
 * Fetch pins with same branch, assuming pins are upload with `DnpPinMetadata` metadata.
 * Can be used to clean all pins from a deleted branch with
 */
export async function fetchPinsWithBranch(
  pinata: PinataPinManager,
  manifest: Manifest,
  gitHead: Pick<GitHead, "branch">
): Promise<PinDataSummary[]> {
  const pinsWithSameBranch = await pinata.pinList<DnpPinMetadata>({
    keyvalues: {
      dnpName: { value: manifest.name, op: "eq" },
      branch: { value: gitHead.branch, op: "eq" }
    }
  });
  return pinsWithSameBranch.map(pin => ({
    commit: pin.metadata.keyvalues?.commit,
    ipfsHash: pin.ipfs_pin_hash
  }));
}

/**
 * Fetch pins with same branch, assuming pins are upload with `DnpPinMetadata` metadata.
 * Can be used to clean all pins from a deleted branch with
 */
export async function fetchPinsGroupedByBranch(
  pinata: PinataPinManager,
  manifest: Manifest
): Promise<PinsByBranch[]> {
  const pins = await pinata.pinList<DnpPinMetadata>({
    keyvalues: {
      dnpName: { value: manifest.name, op: "eq" }
    }
  });

  return groupPinsByBranch(pins);
}

/**
 * Fetch pins with same branch, assuming pins are upload with `DnpPinMetadata` metadata.
 * Returns only pins associated with a commit that is previous
 * to current commit from `gitHead`, according to `git --is-ancestor`.
 */
export async function fetchPinsWithBranchToDelete(
  pinata: PinataPinManager,
  manifest: Manifest,
  gitHead: GitHead,
  dir?: string
): Promise<PinDataSummary[]> {
  const pins = await fetchPinsWithBranch(pinata, manifest, gitHead);
  const candidates = pins.filter(
    pin =>
      pin.commit &&
      pin.commit !== gitHead.commit &&
      /^[a-f0-9]{7,64}$/i.test(pin.commit)
  );
  const ancestorOf = (commit: string) =>
    isAncestorCommit(commit, gitHead.commit, dir);

  let results = await Promise.all(
    candidates.map(pin => ancestorOf(pin.commit as string))
  );
  // CI checkouts are usually shallow (depth 1), so older pin commits are unknown locally.
  // Fetch the missing history once and re-check only the unresolved commits.
  if (results.includes("unknown") && (await deepenShallowHistory(dir)))
    results = await Promise.all(
      candidates.map((pin, index) =>
        results[index] === "unknown"
          ? ancestorOf(pin.commit as string)
          : results[index]
      )
    );
  // A commit that is still unknown (rewritten, foreign or unfetchable) must never cause an unpin.
  return candidates.filter((pin, index) => results[index] === "ancestor");
}

type AncestryResult = "ancestor" | "not-ancestor" | "unknown";

/** `git merge-base --is-ancestor` exits 0 (yes), 1 (no) or 128 (unknown object). */
async function isAncestorCommit(
  commit: string,
  head: string,
  dir?: string
): Promise<AncestryResult> {
  try {
    await shell(["git", "merge-base", "--is-ancestor", commit, head], {
      cwd: dir
    });
    return "ancestor";
  } catch (e) {
    return e.code === 1 ? "not-ancestor" : "unknown";
  }
}

/** Returns true if the repository was shallow and its full history was fetched. */
async function deepenShallowHistory(dir?: string): Promise<boolean> {
  try {
    const shallow = await shell(
      ["git", "rev-parse", "--is-shallow-repository"],
      { cwd: dir }
    );
    if (shallow.trim() !== "true") return false;
    await shell(
      ["git", "fetch", "--unshallow", "--no-tags", "--quiet", "origin"],
      {
        cwd: dir,
        timeout: 10 * 60 * 1000
      }
    );
    return true;
  } catch (e) {
    console.warn(`Could not fetch git history to check old pins: ${e.message}`);
    return false;
  }
}
