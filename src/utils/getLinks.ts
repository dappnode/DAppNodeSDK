import querystring from "querystring";
import { TxData } from "../types";

const adminUiBaseUrl = "http://my.dappnode/#";

/**
 * Get link to publish a TX from a txData object
 * @param txData
 */
export function getPublishTxLink(txData: TxData) {
  // txData => Admin UI link
  const txDataShortKeys: { [key: string]: string } = {
    r: txData.ensName,
    v: txData.currentVersion,
    h: txData.releaseMultiHash
  };
  // Only add developerAddress if necessary to not pollute the link
  if (txData.developerAddress) txDataShortKeys.d = txData.developerAddress;
  const queryData = querystring.stringify(txDataShortKeys);

  return `${adminUiBaseUrl}/sdk/publish/${queryData}`;
}

/**
 * Get link to install a DNP from its path
 * @param {string} releaseMultiHash
 */
export function getInstallDnpLink(releaseMultiHash: string) {
  return `${adminUiBaseUrl}/installer/${encodeURIComponent(releaseMultiHash)}`;
}
