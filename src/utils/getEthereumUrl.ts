export function getEthereumUrl(provider = "dappnode"): string {
  if (provider === "dappnode") {
    return "http://fullnode.dappnode:8545";
  } else if (provider === "remote") {
    return "https://web3.dappnode.net";
  } else if (provider === "infura") {
    // Make sure to change this common Infura token
    // if it stops working or you prefer to use your own
    return "https://mainnet.infura.io/v3/bb15bacfcdbe45819caede241dcf8b0d";
  } else {
    return provider;
  }
}
