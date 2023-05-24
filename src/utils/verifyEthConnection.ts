import { getEthereumUrl } from "./getEthereumUrl.js";
import { CliError } from "../params.js";
import { ethers } from "ethers";

/**
 * Verify the eth connection outside of the eth library to ensure
 * capturing HTTP errors
 * @param ethProvider
 */
export async function verifyEthConnection(ethProvider: string): Promise<void> {
  if (!ethProvider) throw Error("No ethProvider provided");

  const provider = new ethers.JsonRpcProvider(getEthereumUrl(ethProvider));

  try {
    const network = await provider.getNetwork();
    if (!network) {
      throw new CliError(`Could not reach ETH provider at ${ethProvider}`);
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