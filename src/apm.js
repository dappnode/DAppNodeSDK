var ENS = require('ethereum-ens');
var Web3 = require('web3');

var web3
var ens
var provider

async function getLatestVersion(appId) {
    provider = new Web3.providers.WebsocketProvider('ws://my.ethchain.dnp.dappnode.eth:8546');

    if (!provider.sendAsync) {
        provider.sendAsync = provider.send
    }
    web3 = new Web3(provider)
    ens = new ENS(provider);

    return getRepository(appId)
        .then((repository) =>
            repository.methods.getLatest().call()
        )
        .then((res) => {

            return returnVersion(res);
        })
}

function getRepository(appId) {
    return repoAddress(appId)
        .then(
            (address) => new web3.eth.Contract(
                require('@aragon/os/build/contracts/Repo.json').abi,
                address
            )
        )
}

function closeProvider(appId) {
    provider.connection.close()
}

function repoAddress(appId) {
    return ens.resolver(appId).addr();
}

function returnVersion(version) {
    return {
        contractAddress: version.contractAddress,
        version: version.semanticVersion.join('.'),
        content: web3.utils.hexToAscii(version.contentURI),
        contentURI: version.contentURI
    }
}

/**
 * Get the APM repository registry address for `appId`.
 *
 * @param {string} appId
 * @return {Promise} A promise that resolves to the APM address
 */
function getRepoRegistryAddress(appId) {
    const repoId = getRepoId(appId)

    return ens.resolver(repoId).addr()
}

/**
 * Get the APM repository registry contract for `appId`.
 *
 * @param {string} appId
 * @return {Promise} A promise that resolves to the Web3 contract
 */
function getRepoRegistry(appId) {
    return getRepoRegistryAddress(appId)
        .then(
            (address) => new web3.eth.Contract(
                require('@aragon/os/build/contracts/APMRegistry.json').abi,
                address
            )
        )
}

function getRepoId(appId) {
    return appId.split('.').slice(1).join('.')
}

module.exports = {
    getLatestVersion,
    getRepository,
    closeProvider,
    getRepoRegistryAddress,
    getRepoRegistry
}