import { ComposeVersionsToUpdate } from "../types.js";

/**
 * This function is used to get the upstream version from the versionsToUpdate object
 * It is used only for the legacy format, which includes upstreamVersion, upstreaRepo and upstreamArg fields
 * The value returned by this function is set to the upstreamVersion field in the manifest
 * 
 * @param versionsToUpdate Object with the versions to update
 * @returns The upstream version
 * @throws Error if there are multiple versions to update (not supported in legacy upstream format)
 */
export function getLegacyUpstreamVersion(versionsToUpdate: ComposeVersionsToUpdate): string {
    const entries = Object.entries(versionsToUpdate);

    if (entries.length !== 1)
        throw new Error("Multiple upstream repos are not supported in this format. For this, define 'upstream' field in the manifest.");

    const [, { newVersion }] = entries[0];
    return newVersion;

}