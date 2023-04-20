import { stakerPkgs } from "./types.js";

export function getIsStakerPkg(dnpName: string): boolean {
  if (!dnpName) throw Error("dnpName must be defined: ");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stakerPkgs.includes(dnpName as any);
}
