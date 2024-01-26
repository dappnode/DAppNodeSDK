/**
 * Returns the legacy image path for the given container name and version
 * @param name Container name
 * @param version Container version
 * @returns Legacy image path in the format <name>_<version>.tar.xz
 */
export const getLegacyImagePath = (name: string, version: string): string =>
  `${name}_${version}.tar.xz`;
