import { Manifest, UpstreamItem } from "@dappnode/types";
import { readManifest, readCompose } from "../../../../files/index.js";
import { arrIsUnique } from "../../../../utils/array.js";
import { getFirstAvailableEthProvider } from "../../../../utils/tryEthProviders.js";
import { InitialSetupData, GitSettings, UpstreamSettings } from "../types.js";
import { fetchGithubUpstreamVersion } from "../github/fetchGithubUpstreamVersion.js";

export async function getInitialSettings({
  dir,
  userEthProvider,
  useFallback
}: {
  dir: string;
  userEthProvider: string;
  useFallback: boolean;
}): Promise<InitialSetupData> {
  const { manifest, format } = readManifest([{ dir }]);
  const compose = readCompose([{ dir }]);

  const upstreamSettings = await parseUpstreamSettings(manifest);

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
    ethProvider: ethProviderAvailable
  };
}

/**
 * Supports both legacy 'upstreamRepo' and 'upstreamArg' fields and current 'upstream'
 * field (array of objects with 'repo', 'arg' and 'version' fields)
 */
async function parseUpstreamSettings(
  manifest: Manifest
): Promise<UpstreamSettings[] | null> {
  const upstreamSettings = manifest.upstream
    ? await parseUpstreamSettingsNewFormat(manifest.upstream)
    : await parseUpstreamSettingsLegacyFormat(manifest);

  if (!upstreamSettings || upstreamSettings.length < 1) return null;

  validateUpstreamSettings(upstreamSettings);

  return upstreamSettings;
}

async function parseUpstreamSettingsNewFormat(
  upstream: UpstreamItem[]
): Promise<UpstreamSettings[]> {
  const upstreamPromises = upstream.map(async ({ repo, arg, version }) => {
    const githubVersion = await fetchGithubUpstreamVersion(repo);

    if (githubVersion)
      return { repo, arg, manifestVersion: version, githubVersion };
  });

  const upstreamResults = await Promise.all(upstreamPromises);
  return upstreamResults.filter(
    item => item !== undefined
  ) as UpstreamSettings[];
}

/**
 * Legacy support for 'upstreamRepo' and 'upstreamArg' fields
 * Currently, 'upstream' field is used instead, which is an array of objects with 'repo', 'arg' and 'version' fields
 */
async function parseUpstreamSettingsLegacyFormat(
  manifest: Manifest
): Promise<UpstreamSettings[] | null> {
  // 'upstreamRepo' and 'upstreamArg' being defined as arrays has been deprecated

  if (!manifest.upstreamRepo || manifest.upstreamRepo.trim() === "")
    return null;

  const githubVersion = await fetchGithubUpstreamVersion(manifest.upstreamRepo);

  if (!githubVersion) return null;

  return [
    {
      repo: manifest.upstreamRepo,
      manifestVersion: manifest.upstreamVersion || "UPSTREAM_VERSION",
      arg: manifest.upstreamArg || "UPSTREAM_VERSION",
      githubVersion
    }
  ];
}

function getEthProviders(
  useFallback: boolean,
  userEthProvider: string
): string[] {
  const defaultEthProviders = ["remote", "infura"];

  const ethProviders = useFallback
    ? [
        userEthProvider,
        ...defaultEthProviders.filter(p => p !== userEthProvider)
      ]
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
  if (!arrIsUnique(upstreamSettings.map(s => s.repo)))
    throw new Error("Upstream repositories must be unique");

  if (!arrIsUnique(upstreamSettings.map(s => s.arg)))
    throw new Error("Upstream args must be unique");
}
