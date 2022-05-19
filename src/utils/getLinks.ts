import querystring from "querystring";
import { URL } from "url";
import { publishTxAppUrl } from "../params";

const adminUiBaseUrl = "http://my.dappnode/#";

/**
 * Get link to publish a TX from a txData object
 * @param txData
 */
export function getPublishTxLink(txData: {
  dnpName: string;
  version: string;
  releaseMultiHash: string;
  developerAddress?: string;
}): string {
  // txData => Admin UI link
  const txDataShortKeys: { [key: string]: string } = {
    r: txData.dnpName,
    v: txData.version,
    h: txData.releaseMultiHash
  };
  // Only add developerAddress if necessary to not pollute the link
  if (txData.developerAddress) txDataShortKeys.d = txData.developerAddress;

  const url = new URL(publishTxAppUrl);
  url.search = querystring.stringify(txDataShortKeys);
  return url.toString();
}

/**
 * Get link to install a DNP from its path
 * @param releaseMultiHash
 */
export function getInstallDnpLink(releaseMultiHash: string): string {
  return `${adminUiBaseUrl}/installer/${encodeURIComponent(releaseMultiHash)}`;
}
