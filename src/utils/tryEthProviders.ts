import { verifyEthConnection } from "./verifyEthConnection";

/**
 * Tries to connect to Ethereum providers in the order they appear in the input array.
 * Logs error messages and fallback attempts for each failed provider.
 * @param {string[]} providers - An array of Ethereum provider names (e.g., ['dappnode', 'infura']).
 * @returns {Promise<string>} A promise that resolves to the first successfully connected provider's name
 * or an empty string if none of the providers could be connected.
 */
export async function tryEthProviders({
  providers
}: {
  providers: string[];
}): Promise<string> {
  for (const provider of providers) {
    try {
      await verifyEthConnection(provider);
      return provider;
    } catch (e) {
      console.log(`Error connecting to ${provider} ethProvider: ${e.message}`);
    }
  }

  return "";
}
