import { Apm } from "./Apm";
import { CliError } from "../params";

/**
 * Verify the eth connection outside of the eth library to ensure
 * capturing HTTP errors
 * @param ethProvider
 */
export async function verifyEthConnection(ethProvider: string): Promise<void> {
  if (!ethProvider) throw Error("No ethProvider provided");

  const apm = new Apm(ethProvider);
  try {
    const isListening = await apm.provider.send("net_listening", []);
    if (isListening === false) {
      throw new CliError(`Eth provider ${ethProvider} is not listening`);
    }
  } catch (e) {
    if (ethProvider === "dappnode") {
      throw new CliError(
        `Can't connect to DAppNode, check your VPN connection`
      );
    } else if (ethProvider === "infura") {
      throw new CliError(`Can't connect to Infura's mainnet endpoint`);
    } else {
      throw new CliError(`Could not reach ETH provider at ${ethProvider}`);
    }
  }
}
