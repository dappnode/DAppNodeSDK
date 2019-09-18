// Format txData for the dappnode ADMIN UI
const stringifyUrlQuery = obj =>
  Object.keys(obj)
    .map(key => `${key}=${encodeURIComponent(obj[key])}`)
    .join("&");

const adminPublishUrl = "http://my.dappnode/#/sdk/publish/";

function getTxDataAdminUiLink({ txData }) {
  // txData => Admin UI link
  const txDataShortKeys = {
    r: txData.ensName,
    v: txData.currentVersion,
    h: txData.releaseIpfsPath
  };
  // Only add developerAddress if necessary to not pollute the link
  if (txData.developerAddress) txDataShortKeys.d = txData.developerAddress;
  return `${adminPublishUrl}${stringifyUrlQuery(txDataShortKeys)}`;
}

module.exports = getTxDataAdminUiLink;
