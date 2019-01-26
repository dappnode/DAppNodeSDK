const IpfsAPI = require('ipfs-http-client');

function getIpfsProviderUrl(provider = 'dappnode') {
  if (provider === 'dappnode') {
    return 'http://my.ipfs.dnp.dappnode.eth';
  } else if (provider === 'infura') {
    return 'https://ipfs.infura.io';
  } else {
    return provider;
  }
}

function parseIpfsProviderUrl(provider) {
  if (provider.includes('://')) {
    // http://my.ipfs.dnp.dappnode.eth
    // http://my.ipfs.dnp.dappnode.eth:5002
    const [protocol, hostAndPort] = provider.split('://');
    const [host, port = 5001] = hostAndPort.split(':');
    return {host, port, protocol};
  } else {
    // my.ipfs.dnp.dappnode.eth
    // my.ipfs.dnp.dappnode.eth:5002
    const [host, port = 5001] = provider.split(':');
    return {host, port, protocol: 'https'};
  }
}

/**
 *
 * @param {String} provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "localhost:5002"
 * - "my.ipfs.dnp.dappnode.eth"
 * @return {Object} apm instance
 */
function Ipfs(provider) {
  // Initialize ens and web3 instances
  // Use http providers to avoid opened websocket connection
  // This application does not need subscriptions and performs very few requests per use
  const providerUrl = getIpfsProviderUrl(provider);
  const providerObject = parseIpfsProviderUrl(providerUrl);
  const ipfs = new IpfsAPI(providerObject);

  // return exposed methods
  return ipfs;
}


module.exports = Ipfs;
