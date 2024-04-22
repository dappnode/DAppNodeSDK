import { ComposeVersionsToUpdate } from "../types.js";

// https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0
export function getUpstreamVersionTag(versionsToUpdate: ComposeVersionsToUpdate): string {
    const entries = Object.entries(versionsToUpdate);

    if (entries.length !== 1)
        throw new Error("Multiple upstream repos are not supported in this format. For this, define 'upstream' field in the manifest.");

    const [, { newVersion }] = entries[0];
    return newVersion;

}