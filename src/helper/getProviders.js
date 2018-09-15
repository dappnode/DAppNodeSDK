const Web3 = require('web3');
const chalk = require('chalk');
const ENS = require('ethereum-ens');

let provider;
let web3;
let ens;

function getProvider() {
  if (provider) return provider;
  provider = new Web3.providers.WebsocketProvider('ws://my.ethchain.dnp.dappnode.eth:8546');
  provider.on("error", (e) => handleDisconnects(e));
  provider.on("close", (e) => handleDisconnects(e));

  if (!provider.sendAsync) {
    provider.sendAsync = provider.send
  }

  return provider;
}

function handleDisconnects(e) {
  console.log(chalk.red('You must be connected to your DAppNode, please check your connection'))
  process.exit(1)
}

function getENS() {
  if (ens) return ens;
  ens = new ENS(getProvider());
  return ens;
}

function getWeb3() {
  if (web3) return web3;
  web3 = new Web3(getProvider());
  return web3;
}

module.exports = {
  getWeb3,
  getENS,
  getProvider
}