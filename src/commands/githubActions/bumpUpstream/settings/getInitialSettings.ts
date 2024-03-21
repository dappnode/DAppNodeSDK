import { readManifest, readCompose } from "../../../../files/index.js";
import { arrIsUnique } from "../../../../utils/array.js";
import { parseCsv } from "../../../../utils/csv.js";
import { getFirstAvailableEthProvider } from "../../../../utils/tryEthProviders.js";
import { InitialSetupData, GitSettings } from "../types.js";

export async function getInitialSettings({ dir, userEthProvider, useFallback }: { dir: string, userEthProvider: string, useFallback: boolean }): Promise<InitialSetupData> {
    const { manifest, format } = readManifest({ dir });
    const compose = readCompose({ dir });

    // TODO: Update when upstream fields in manifest follow the new format described in https://github.com/dappnode/DAppNodeSDK/issues/408
    const upstreamRepos = parseCsv(manifest.upstreamRepo);
    const upstreamArgs = parseCsv(manifest.upstreamArg || "UPSTREAM_VERSION");

    // Create upstream settings after validation
    validateUpstreamData(upstreamRepos, upstreamArgs);
    const upstreamSettings = upstreamRepos.map((repo, i) => ({
        upstreamRepo: repo,
        upstreamArg: upstreamArgs[i],
    }));

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

function validateUpstreamData(upstreamRepos: string[], upstreamArgs: string[]): void {
    if (upstreamRepos.length < 1)
        throw new Error("Must provide at least one 'upstream_repo'");

    if (upstreamRepos.length !== upstreamArgs.length)
        throw new Error(`'upstream_repo' must have the same length as 'upstream_argNames'. Got ${upstreamRepos.length} repos and ${upstreamArgs.length} args.`);

    if (!arrIsUnique(upstreamRepos))
        throw new Error("upstreamRepos not unique");

    if (!arrIsUnique(upstreamArgs))
        throw new Error("upstreamArgs not unique");
}