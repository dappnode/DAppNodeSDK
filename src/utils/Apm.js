const Ens = require('ethereum-ens');
const Web3 = require('web3');
const arrayToSemver = require('../utils/arrayToSemver');
const repoAbi = require('@aragon/os/build/contracts/Repo.json').abi;
const registryAbi = require('@aragon/os/build/contracts/APMRegistry.json').abi;

function getEthereumProviderUrl(provider = 'dappnode') {
  if (provider === 'dappnode') {
    return 'http://my.ethchain.dnp.dappnode.eth:8545';
  } else if (provider === 'infura') {
    return 'https://mainnet.infura.io';
  } else {
    return provider;
  }
}

/**
 *
 * @param {String} provider user selected provider. Possible values:
 * - null
 * - "dappnode"
 * - "infura"
 * - "http://localhost:8545"
 * - "ws://localhost:8546"
 * @return {Object} apm instance
 */
function Apm(provider) {
  // Initialize ens and web3 instances
  // Use http providers to avoid opened websocket connection
  // This application does not need subscriptions and performs very few requests per use
  const providerUrl = getEthereumProviderUrl(provider);
  const web3 = new Web3(providerUrl);
  const _provider = web3.currentProvider;
  // Correct incompatibility between modules
  _provider.sendAsync = _provider.sendAsync || _provider.send;
  const ens = new Ens(_provider);

  // Verify if the connection is active
  let connectionVerified = false;
  async function verifyConnection() {
    if (connectionVerified) return;
    try {
      const isListening = await web3.eth.net.isListening();
      if (!isListening) throw Error('Network is not listening');
      connectionVerified = true;
    } catch (e) {
      let msg;
      if (!e.message.includes('Invalid JSON RPC response')) {
        msg = e.message;
      }
      let host = `eth provider ${web3.currentProvider.host}`;
      if (host.includes('ethchain.dnp.dappnode.eth')) host = 'your DAppNode. Please make sure your VPN connection is active';
      console.error(`Could not connect to ${host} ${msg ? `- Error message: ${msg}` : ''}`);
      process.exit(1);
    }
  }

  // Ens throws if a node is not found
  //
  // ens.resolver('admin.dnp.dappnode.eth').addr()
  // ==> 0xee66c4765696c922078e8670aa9e6d4f6ffcc455
  // ens.resolver('fake.dnp.dappnode.eth').addr()
  // ==> Unhandled rejection Error: ENS name not found
  //
  // Change behaviour to return null if not found
  async function resolve(ensDomain) {
    await verifyConnection();
    try {
      return await ens.resolver(ensDomain).addr();
    } catch (e) {
      if (e.message.includes('not found')) return null;
      else throw e;
    }
  }

  /**
   * Get the lastest version of an APM repo contract for an ENS domain.
   *
   * @param {String} ensName: "admin.dnp.dappnode.eth"
   * @return {String} latest semver version = '0.1.0'
   */
  async function getLatestVersion(ensName) {
    if (!ensName) throw Error('getLatestVersion first argument ensName must be defined');
    await verifyConnection();
    const repository = await getRepoContract(ensName);
    if (!repository) {
      const registry = getRegistryContract(ensName);
      if (registry) throw Error(`Error NOREPO: you must first deploy the repo of ${ensName} using the command publish`);
      else throw Error(`Error: there must exist a registry for DNP name ${ensName}`);
    }
    const res = await repository.methods.getLatest().call().catch((e) => {
      // Rename error for user comprehension
      e.message = `Error getting latest version of ${ensName}: ${e.message}`;
      throw e;
    });
    return arrayToSemver(res.semanticVersion);
  }

  /**
   * Get the APM repo contract for an ENS domain.
   * ENS domain:      admin.dnp.dappnode.eth
   *
   * @param {String} ensName: "admin.dnp.dappnode.eth"
   * @return {Contract} contract instance of the Repo "admin.dnp.dappnode.eth"
   */
  async function getRepoContract(ensName) {
    if (!ensName) throw Error('getRepoContract first argument ensName must be defined');
    const repoAddress = await resolve(ensName);
    if (!repoAddress) return null;
    return new web3.eth.Contract(repoAbi, repoAddress);
  }

  /**
   * Get the APM registry contract for an ENS domain.
   * It will slice the first subdomain and query the rest as:
   * ENS domain:      admin.dnp.dappnode.eth
   * Registry domain:       dnp.dappnode.eth
   *
   * @param {String} ensName: "admin.dnp.dappnode.eth"
   * @return {Contract} contract instance of the Registry "dnp.dappnode.eth"
   */
  async function getRegistryContract(ensName) {
    if (!ensName) throw Error('getRegistryContract first argument ensName must be defined');
    const repoId = ensName.split('.').slice(1).join('.');
    const registryAddress = await resolve(repoId);
    if (!registryAddress) return null;
    return new web3.eth.Contract(registryAbi, registryAddress);
  }

  // return exposed methods
  return {
    getLatestVersion,
    getRepoContract,
    getRegistryContract,
    providerUrl,
  };
}


module.exports = Apm;
