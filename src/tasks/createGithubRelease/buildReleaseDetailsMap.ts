import { ListrContextPublish } from "../../types.js";
import { ReleaseDetailsMap } from "./types.js";

export function buildReleaseDetailsMap(
  ctx: ListrContextPublish
): ReleaseDetailsMap {
  const releaseDetailsMap: ReleaseDetailsMap = {};

  for (const [
    dnpName,
    { nextVersion, releaseMultiHash, txData, releaseDir, variant }
  ] of Object.entries(ctx)) {
    if (!nextVersion || !releaseMultiHash || !txData || !releaseDir)
      throw new Error(`Missing required release details for ${dnpName}`);

    releaseDetailsMap[dnpName] = {
      nextVersion,
      releaseMultiHash,
      txData,
      releaseDir,
      variant
    };
  }

  return releaseDetailsMap;
}
