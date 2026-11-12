import { readManifest, readCompose } from "../../../../files/index.js";
import { getFirstAvailableEthProvider } from "../../../../utils/tryEthProviders.js";
import { InitialSetupData, GitSettings } from "../types.js";
import { resolvePackage } from "../../../../bump/plan.js";
import { RegistryClient } from "../../../../bump/registry.js";
import { fetchGithubUpstreamVersion } from "../github/fetchGithubUpstreamVersion.js";

export async function getInitialSettings({
  dir,
  userEthProvider,
  useFallback,
  explicitVersion
}: {
  dir: string;
  userEthProvider: string;
  useFallback: boolean;
  explicitVersion?: string;
}): Promise<InitialSetupData> {
  const { manifest, format } = readManifest([{ dir }]);
  const compose = readCompose([{ dir }]);

  const resolved = await resolvePackage(
    dir,
    {
      latestRelease: fetchGithubUpstreamVersion,
      registry: new RegistryClient()
    },
    explicitVersion
  );
  const upstreamSettings = resolved.length
    ? resolved.map(item => ({
        repo: item.repo,
        arg: item.arg,
        provider: item.provider,
        tagPattern: item.tagPattern,
        manifestVersion: item.version,
        githubVersion: item.targetVersion,
        composeValue: item.composeValue
      }))
    : null;

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
