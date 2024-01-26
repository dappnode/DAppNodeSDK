import { Architecture } from "@dappnode/types";

/**
 * Returns the image path for the given container name, version and architecture
 * @param name Container name
 * @param version Container version
 * @param arch Container architecture in the format <os>/<arch>
 * @returns Image path in the format <name>_<version>_<os>-<arch>.txz
 */
export const getImagePath = (
  name: string,
  version: string,
  arch: Architecture
): string => `${name}_${version}_${getArchTag(arch)}.txz`;

/**
 * Returns the arch tag for the given architecture
 * @param arch Architecture in the format <os>/<arch>
 * @returns Arch tag in the format <os>-<arch>
 */
const getArchTag = (arch: Architecture): string => arch.replace(/\//g, "-");
