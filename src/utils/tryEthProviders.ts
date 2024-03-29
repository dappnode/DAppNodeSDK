import { verifyEthConnection } from "./verifyEthConnection.js";

/**
 * Tries to connect to Ethereum providers in the order they appear in the input array.
 * Logs error messages and fallback attempts for each failed provider.
 * @param {string[]} providers - An array of Ethereum provider names (e.g., ['dappnode', 'infura']).
 * @returns {Promise<string>} A promise that resolves to the first successfully connected provider's name
 * or an empty string if none of the providers could be connected.
 */
export async function getFirstAvailableEthProvider({
  providers
}: {
  providers: string[];
}): Promise<string | undefined> {
  for (const provider of providers) {
    try {
      await verifyEthConnection(provider);
      console.log(`Connected to ${provider} eth provider`);
      return provider;
    } catch (e) {
      console.log(`Error connecting to ${provider} ethProvider: ${e.message}`);
    }
  }

  return undefined;
}
