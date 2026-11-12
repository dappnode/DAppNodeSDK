import { readManifest, readCompose } from "../../../../files/index.js";
import { getFirstAvailableEthProvider } from "../../../../utils/tryEthProviders.js";
import { InitialSetupData, GitSettings, UpstreamSettings } from "../types.js";
import { resolvePackage } from "../../../../bump/plan.js";
import { RegistryClient } from "../../../../bump/registry.js";
import { ResolvedUpstream } from "../../../../bump/resolve.js";
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

  const resolvedUpstreams = await resolvePackage(
    dir,
    {
      latestRelease: fetchGithubUpstreamVersion,
      registry: new RegistryClient()
    },
    explicitVersion
  );
  const upstreamSettings =
    resolvedUpstreams.length > 0
      ? resolvedUpstreams.map(toUpstreamSettings)
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
    resolvedUpstreams,
    manifestData: { manifest, format },
    compose,
    gitSettings,
    ethProvider: ethProviderAvailable
  };
}

function toUpstreamSettings(upstream: ResolvedUpstream): UpstreamSettings {
  return {
    repo: upstream.repo,
    arg: upstream.arg,
    provider: upstream.provider,
    tagPattern: upstream.tagPattern,
    manifestVersion: upstream.version,
    githubVersion: upstream.targetVersion,
    composeValue: upstream.composeValue
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
