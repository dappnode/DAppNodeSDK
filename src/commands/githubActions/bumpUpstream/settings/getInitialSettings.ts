import { Manifest } from "@dappnode/types";
import { readManifest, readCompose } from "../../../../files/index.js";
import { arrIsUnique } from "../../../../utils/array.js";
import { getFirstAvailableEthProvider } from "../../../../utils/tryEthProviders.js";
import { InitialSetupData, GitSettings, UpstreamSettings } from "../types.js";

export async function getInitialSettings({ dir, userEthProvider, useFallback }: { dir: string, userEthProvider: string, useFallback: boolean }): Promise<InitialSetupData> {
    const { manifest, format } = readManifest({ dir });
    const compose = readCompose({ dir });

    const upstreamSettings = parseUpstreamSettings(manifest);

    const gitSettings = getGitSettings();

    const ethProviders = getEthProviders(useFallback, userEthProvider);

    const ethProviderAvailable = await getFirstAvailableEthProvider({
        providers: ethProviders
    });

    if (!ethProviderAvailable)
        throw Error(`No eth provider available. Tried: ${ethProviders.join(", ")}`);

    return {
        upstreamSettings,
        manifestData: { manifest, format },
        compose,
        gitSettings,
        ethProvider: ethProviderAvailable,
    };
}

/**
 * Supports both legacy 'upstreamRepo' and 'upstreamArg' fields and current 'upstream' 
 * field (array of objects with 'repo', 'arg' and 'version' fields)
 */
function parseUpstreamSettings(manifest: Manifest): UpstreamSettings[] {

    const upstreamSettings =
        manifest.upstream
            ? manifest.upstream
            : parseUpstreamSettingsFromLegacy(manifest);

    validateUpstreamSettings(upstreamSettings);

    return upstreamSettings;
}

/**
 * Legacy support for 'upstreamRepo' and 'upstreamArg' fields
 * Currently, 'upstream' field is used instead, which is an array of objects with 'repo', 'arg' and 'version' fields
 */
function parseUpstreamSettingsFromLegacy(manifest: Manifest): UpstreamSettings[] {
    // 'upstreamRepo' and 'upstreamArg' being defined as arrays has been deprecated

    if (!manifest.upstreamRepo)
        return [];

    return [{
        repo: manifest.upstreamRepo,
        arg: manifest.upstreamArg || "UPSTREAM_VERSION",
    }];
}

function getEthProviders(useFallback: boolean, userEthProvider: string): string[] {
    const defaultEthProviders = ["remote", "infura"];

    const ethProviders = useFallback
        ? [userEthProvider, ...defaultEthProviders.filter(p => p !== userEthProvider)]
        : [userEthProvider];

    return ethProviders;
}

function getGitSettings(): GitSettings {
    const githubActor = process.env.GITHUB_ACTOR || "bot";
    const userEmail = `${githubActor}@users.noreply.github.com`;

    return {
        userName: githubActor,
        userEmail
    };
}

function validateUpstreamSettings(upstreamSettings: UpstreamSettings[]): void {
    if (upstreamSettings.length < 1)
        throw new Error("Must provide at least one 'upstreamRepo'");

    if (!arrIsUnique(upstreamSettings.map(s => s.repo)))
        throw new Error("Upstream repositories must be unique");

    if (!arrIsUnique(upstreamSettings.map(s => s.arg)))
        throw new Error("Upstream args must be unique");
}