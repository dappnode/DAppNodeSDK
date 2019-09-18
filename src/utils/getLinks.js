const adminUiBaseUrl = "http://my.dappnode/#";

/**
 * Get link to publish a TX from a txData object
 * @param {object} txData
 */
function publishTx({ txData }) {
  // txData => Admin UI link
  const txDataShortKeys = {
    r: txData.ensName,
    v: txData.currentVersion,
    h: txData.releaseIpfsPath
  };
  // Only add developerAddress if necessary to not pollute the link
  if (txData.developerAddress) txDataShortKeys.d = txData.developerAddress;
  return `${adminUiBaseUrl}/sdk/publish/${stringifyUrlQuery(txDataShortKeys)}`;
}

/**
 * Get link to install a DNP from its path
 * @param {string} releaseIpfsPath
 */
function installDnp({ releaseIpfsPath }) {
  return `${adminUiBaseUrl}/installer/${encodeURIComponent(releaseIpfsPath)}`;
}

// Utils

function stringifyUrlQuery(obj) {
  return Object.keys(obj)
    .map(key => `${key}=${encodeURIComponent(obj[key])}`)
    .join("&");
}

module.exports = {
  publishTx,
  installDnp
};
