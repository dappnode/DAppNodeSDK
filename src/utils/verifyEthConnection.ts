import { CliError } from "../params";
import { getPM } from "../providers/pm";

/**
 * Verify the eth connection outside of the eth library to ensure
 * capturing HTTP errors
 * @param ethProvider
 */
export async function verifyEthConnection(ethProvider: string): Promise<void> {
  if (!ethProvider) throw Error("No ethProvider provided");

  const pm = getPM(ethProvider);

  try {
    if (!(await pm.isListening())) {
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
