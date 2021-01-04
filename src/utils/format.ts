import { Manifest } from "../types";
import { GitHead } from "./git";

export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * - Strip container prefix
 * - Strip .dappnode, .eth, .dnp
 * - Strip "_"
 *
 * @param name "bitcoin.dnp.dappnode.eth"
 * @returns "bitcoin"
 * - "bitcoin.dnp.dappnode.eth" > "bitcoin.dappnode"
 * - "other.public.dappnode.eth" > "other.public.dappnode"
 *
 * name=$(echo $name | sed 's/DAppNodePackage-//g'| sed 's/\.dappnode\.eth//g' |  sed 's/\.dnp//g' | tr -d '/_')
 */
export function getShortDomain(dnpName: string): string {
  for (const suffix of [".dnp.dappnode.eth", ".dappnode.eth", ".eth"])
    if (dnpName.endsWith(suffix)) return dnpName.slice(0, -suffix.length);
  return dnpName;
}

export function prettyPinataPinName(
  manifest: Manifest,
  gitHead?: GitHead
): string {
  const shortDomain = getShortDomain(manifest.name);

  if (gitHead) {
    return `${shortDomain} ${gitHead.branch} ${gitHead.commit.slice(0, 7)}`;
  } else {
    return `${shortDomain} v${manifest.version}`;
  }
}
