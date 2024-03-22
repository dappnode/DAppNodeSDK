import { ReleaseType } from "../../types.js";
import { readManifest } from "../../files/index.js";
import { getNextVersionFromApmByEns } from "./getNextVersionFromApmByEns.js";

export async function getNextVersionFromApm({
  type,
  ethProvider,
  dir
}: {
  type: ReleaseType;
  ethProvider: string;
  dir: string;
}): Promise<string> {
  // Load manifest
  const { manifest } = readManifest({ dir });
  const ensName = manifest.name;

  return getNextVersionFromApmByEns({ type, ethProvider, ensName });
}
