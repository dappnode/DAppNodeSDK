import { Compose } from "@dappnode/types";

/**
 * Remove the obsolete top-level version from a parsed Compose object.
 *
 * Compose still declares version as required in @dappnode/types, so use
 * Reflect.deleteProperty until that shared type makes the property optional.
 */
export function stripComposeVersion(compose: Compose): void {
  Reflect.deleteProperty(compose, "version");
}
