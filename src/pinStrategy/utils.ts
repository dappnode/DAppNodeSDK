import { PinItem } from "../releaseUploader/pinata";
import { DnpPinMetadata, PinDataSummary, PinsByBranch } from "./types";

export function groupPinsByBranch(
  pins: PinItem<DnpPinMetadata>[]
): PinsByBranch[] {
  const pinsByBranch = new Map<string, PinDataSummary[]>();
  for (const pin of pins) {
    const commit = pin.metadata.keyvalues?.commit;
    const branch = pin.metadata.keyvalues?.branch;
    const ipfsHash = pin.ipfs_pin_hash;

    if (!branch) continue;
    let onBranch = pinsByBranch.get(branch);

    if (!onBranch) onBranch = [];
    onBranch.push({ commit, ipfsHash });
    pinsByBranch.set(branch, onBranch);
  }

  return Array.from(pinsByBranch.entries()).map(([branch, pins]) => ({
    branch,
    pins
  }));
}
