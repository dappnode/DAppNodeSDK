import { CliError } from "../../params";
import { Apm } from "./apm";
import { IPM } from "./interface";
export { IPM };

export function getPM(provider: string): IPM {
  // TODO: Generalize with both APM and DPM
  // TODO: Find a way to switch between both:
  // - Pre-declared in the manifest?
  // - Check on chain in multiple providers?
  return new Apm(provider);
}

/**
 * Verify the eth connection outside of the eth library to ensure
 * capturing HTTP errors
 */
export async function verifyEthConnection(pm: IPM): Promise<void> {
  try {
    if (!(await pm.isListening())) {
      throw new CliError(`Eth provider ${pm.ethProvider} is not listening`);
    }
  } catch (e) {
    if (pm.ethProvider === "dappnode") {
      throw new CliError(
        `Can't connect to DAppNode, check your VPN connection`
      );
    } else if (pm.ethProvider === "infura") {
      throw new CliError(`Can't connect to Infura's mainnet endpoint`);
    } else {
      throw new CliError(`Could not reach ETH provider at ${pm.ethProvider}`);
    }
  }
}
