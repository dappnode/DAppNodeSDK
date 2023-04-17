import { stakerPkgsToKeep } from "./params.js";
import { Network } from "./types.js";

export function getStakerPkgNetwork(dnpName: string): Network {
  if (!stakerPkgsToKeep.includes(dnpName))
    throw Error(`Not a staker package: ${dnpName}`);
  if (dnpName.includes("prater" || "goerli")) return "prater";
  if (dnpName.includes("gnosis" || "xdai")) return "gnosis";
  return "mainnet";
}
