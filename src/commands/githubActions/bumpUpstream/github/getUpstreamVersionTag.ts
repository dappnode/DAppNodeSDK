import { ComposeVersionsToUpdate } from "../types.js";

// https://github.com/ipfs/go-ipfs/releases/tag/v0.7.0
export function getUpstreamVersionTag(versionsToUpdate: ComposeVersionsToUpdate): string {
    const entries = Object.entries(versionsToUpdate);

    if (entries.length === 1) {
        const [{ newVersion }] = Object.values(versionsToUpdate);
        return newVersion;
    } else {
        return entries
            .map(([repoSlug, { newVersion }]) => `${repoSlug}@${newVersion}`)
            .join(", ");
    }
}