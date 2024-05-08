import { stringsToRemoveFromName, publicRepoDomain } from "./params.js";
import { validateDnpName } from "./validation.js";

export function getShortDnpName(dnpName: string): string {
  validateDnpName(dnpName);
  return dnpName.split(".")[0];
}

/**
 * Adds a variant suffix to a DAppNode package (DNP) name, ensuring the variant is inserted
 * right before the domain part of the DNP name.
 *
 * @param {Object} params - The function parameters.
 * @param {string} params.dnpName - The original DNP name.
 * @param {string} params.variant - The variant to be added to the DNP name.
 * @returns {string} - The modified DNP name including the variant.
 *
 * @example
 *
 * --> Adds the 'mainnet' variant to the DNP name
 *
 * const modifiedDnpName = addVariantToDnpName({ dnpName: "geth.dnp.dappnode.eth", variant: "mainnet" });
 * console.log(modifiedDnpName);
 *
 * --> Output: "geth-mainnet.dnp.dappnode.eth"
 */
export function addVariantToDnpName({
  dnpName,
  variant
}: {
  dnpName: string;
  variant: string;
}): string {
  validateDnpName(dnpName);

  const firstDotAt = dnpName.indexOf(".");
  return `${dnpName.substring(0, firstDotAt)}-${variant}${dnpName.substring(
    firstDotAt
  )}`;
}

/**
 * Parses a directory or generic package name and returns a full ENS guessed name
 * @param name "DAppNodePackage-vipnode"
 * @return "vipnode.public.dappnode.eth"
 */
export function getDnpName(name: string): string {
  // Remove prepended strings if any
  for (const stringToRemove of stringsToRemoveFromName) {
    name = name.replace(stringToRemove, "");
  }

  // Make name lowercase
  name = name.toLowerCase();

  // Append public domain
  return name.endsWith(".eth") ? name : name + publicRepoDomain;
}
