import { PinataMetadata, PinataPinManager } from "../releaseUploader/pinata";
import { Manifest } from "../types";
import { GitHead } from "../utils/git";
import { prettyPinataPinName } from "../utils/format";

/**
 * All logic regarding the pin strategy of DAppNode packages
 * In development, builds will be uploaded on each push on a PR
 * only the latest commit of each branch will stay pinned.
 *
 * When PR is merged (and the branch is deleted) all pins associated to
 * that branch will be unpinned
 */

/**
 * Pinata DAppNodePackage build pin metadata
 */
export interface DnpPinMetadata {
  name: string;
  version: string;
  upstreamVersion: string | undefined;
  commit: string | undefined;
  branch: string | undefined;
}

export function getPinMetadata(
  manifest: Manifest,
  gitHead?: GitHead
): PinataMetadata<DnpPinMetadata> {
  return {
    name: prettyPinataPinName(manifest, gitHead),
    keyvalues: {
      name: manifest.name,
      version: manifest.version,
      upstreamVersion: manifest.upstreamVersion,
      commit: gitHead ? gitHead.commit : undefined,
      branch: gitHead ? gitHead.branch : undefined
    }
  };
}

interface PinDataSummary {
  ipfsHash: string;
  commit?: string;
}

/**
 * Fetch pins with same branch, assuming pins are upload with `DnpPinMetadata` metadata.
 * Can be used to clean all pins from a deleted branch with
 * ```ts
 * const pins = await fetchPinsWithBranch(pinata, manifest, gitHead);
 * for (const pin of pins) await pinata.unpin(pin.ipfsHash);
 * ```
 */
export async function fetchPinsWithBranch(
  pinata: PinataPinManager,
  manifest: Manifest,
  gitHead: Pick<GitHead, "branch">
): Promise<PinDataSummary[]> {
  const pinsWithSameBranch = await pinata.pinList<DnpPinMetadata>({
    keyvalues: {
      name: { value: manifest.name, op: "eq" },
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
 * Returns only pins associated with a commit that is previous
 * to current commit from `gitHead`, according to `git --is-ancestor`.
 */
export async function fetchOldPinsWithBranch(
  pinata: PinataPinManager,
  manifest: Manifest,
  gitHead: GitHead
): Promise<PinDataSummary[]> {
  const pins = await fetchPinsWithBranch(pinata, manifest, gitHead);

  const oldPinsToDelete: PinDataSummary[] = [];
  for (const pin of pins) {
    if (pin.commit && pin.commit !== gitHead.commit) {
      oldPinsToDelete.push(pin);
    }
  }

  return oldPinsToDelete;
}
