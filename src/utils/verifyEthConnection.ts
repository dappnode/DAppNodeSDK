import { Apm } from "./Apm";

/**
 * Verify the eth connection outside of the eth library to ensure
 * capturing HTTP errors
 * @param ethProvider
 */
export function verifyEthConnection(ethProvider: string) {
  if (!ethProvider) throw Error("No ethProvider provided");
  return new Promise((resolve, reject) => {
    const apm = new Apm(ethProvider);
    const provider = apm.provider;
    provider.sendAsync(
      { jsonrpc: "2.0", method: "net_listening", params: [], id: 67 },
      (err, res) => {
        if (err) {
          if (ethProvider === "dappnode") {
            error(`Can't connect to DAppNode, check your VPN connection`);
          } else if (ethProvider === "infura") {
            error(`Can't connect to Infura's mainnet endpoint`);
          } else {
            error(`Could not reach ETH provider at ${ethProvider}`);
          }
        } else if (res && res.result === false) {
          reject(Error(`Eth provider ${ethProvider} is not listening`));
        } else {
          resolve();
        }
      }
    );
  });
}

function error(msg: string) {
  console.error("");
  console.error(msg);
  process.exit(1);
}
