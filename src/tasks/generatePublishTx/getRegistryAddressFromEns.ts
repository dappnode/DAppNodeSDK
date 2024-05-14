import { ethers } from "ethers";

/**
 * Returns the registry address for the given ENS name.
 *
 * Example: geth.dnp.dappnode.eth -> address of [dnp.dappnode.eth]
 */
export async function getRegistryAddressFromDnpName({
  ethereumUrl,
  dnpName
}: {
  ethereumUrl: string;
  dnpName: string;
}): Promise<string> {
  const provider = new ethers.JsonRpcProvider(ethereumUrl);

  const registryEns = getRegistryEns(dnpName);

  const registryAddress = await provider.resolveName(registryEns);

  if (!registryAddress) throw new Error("Registry not found for " + dnpName);

  return registryAddress;
}

/**
 * Returns the ENS name of the registry for the given DNP name.
 *
 * Example: geth.dnp.dappnode.eth -> dnp.dappnode.eth
 */
function getRegistryEns(dnpName: string) {
  return dnpName.split(".").slice(1).join(".");
}
