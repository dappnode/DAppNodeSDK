import { PinataMetadata } from "../releaseUploader/pinata";
import { PinataPinManager } from "../providers/pinata/pinManager";
import { Manifest } from "../types";
import { GitHead } from "../utils/git";
import { prettyPinataPinName } from "../utils/format";
import { DnpPinMetadata, PinDataSummary, PinsByBranch } from "./types";
import { groupPinsByBranch } from "./utils";

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
  return {
    name: prettyPinataPinName(manifest, gitHead),
    keyvalues: {
      dnpName: manifest.name,
      version: manifest.version,
      upstreamVersion: manifest.upstreamVersion,
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
  gitHead: GitHead
): Promise<PinDataSummary[]> {
  const pins = await fetchPinsWithBranch(pinata, manifest, gitHead);
  return pins.filter(pin => pin.commit && pin.commit !== gitHead.commit);
}
