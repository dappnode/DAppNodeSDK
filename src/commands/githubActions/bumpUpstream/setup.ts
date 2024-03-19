import { Manifest, Compose } from "@dappnode/types";
import { readManifest, readCompose } from "../../../files";
import { arrIsUnique } from "../../../utils/array";
import { parseCsv } from "../../../utils/csv";
import { readBuildSdkEnvFileNotThrow } from "../../../utils/readBuildSdkEnv";
import { GitSettings, InitialSetupData, UpstreamSettings } from "./types";
import { getFirstAvailableEthProvider } from "../../../utils/tryEthProviders";

export async function readInitialSetup({ dir, userEthProvider, useFallback }: { dir: string, userEthProvider: string, useFallback: boolean }): Promise<InitialSetupData> {
    const envFileArgs = readBuildSdkEnvFileNotThrow(dir);

    const { manifest, format } = readManifest({ dir });
    const compose = readCompose({ dir });

    const upstreamRepos = envFileArgs
        ? [envFileArgs._BUILD_UPSTREAM_REPO]
        : parseCsv(manifest.upstreamRepo);
    const upstreamArgs = envFileArgs
        ? [envFileArgs._BUILD_UPSTREAM_VERSION]
        : parseCsv(manifest.upstreamArg || "UPSTREAM_VERSION");

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

export function validateUpstreamData(upstreamRepos: string[], upstreamArgs: string[]): void {
    if (upstreamRepos.length < 1)
        throw new Error("Must provide at least one 'upstream_repo'");

    if (upstreamRepos.length !== upstreamArgs.length)
        throw new Error(`'upstream_repo' must have the same length as 'upstream_argNames'. Got ${upstreamRepos.length} repos and ${upstreamArgs.length} args.`);

    if (!arrIsUnique(upstreamRepos))
        throw new Error("upstreamRepos not unique");

    if (!arrIsUnique(upstreamArgs))
        throw new Error("upstreamArgs not unique");
}


export function printSettings(upstreamSettings: UpstreamSettings[], gitSettings: GitSettings, manifest: Manifest, compose: Compose, ethProvider: string): void {

    console.log(`
  
    Upstream Settings - ${JSON.stringify(upstreamSettings, null, 2)}
  
    Git Settings - ${JSON.stringify(gitSettings, null, 2)}
    
    Manifest - ${JSON.stringify(manifest, null, 2)}
    
    Compose - ${JSON.stringify(compose, null, 2)}
    
    ETH Provider - ${ethProvider}
  
    `);
}