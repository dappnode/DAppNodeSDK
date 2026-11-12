import { CommandModule } from "yargs";
import { CliGlobalOptions } from "../../../types.js";
import { defaultDir, defaultVariantsDirName } from "../../../params.js";
import { shell } from "../../../utils/shell.js";
import { getGitHead } from "../../../utils/git.js";
import { buildAndComment } from "../build/index.js";
import { readManifest } from "../../../files/index.js";
import { getPackageManifestDirs } from "../../../bump/discovery.js";
import { planPackageEdits } from "../../../bump/plan.js";
import { writePlan } from "../../../bump/edits.js";
import { printBumpDeprecation } from "./deprecation.js";
import { getNextVersionFromApm } from "../../../utils/versions/getNextVersionFromApm.js";
import { GitSettings, GithubSettings, UpstreamSettings } from "./types.js";
import { printSettings, getInitialSettings } from "./settings/index.js";
import {
  branchNeedsPr,
  closeOldPrs,
  getBumpPrBody,
  getGithubSettings,
  isBranchNew,
  recoverBumpBranch
} from "./github/index.js";

interface CliCommandOptions extends CliGlobalOptions {
  eth_provider: string;
  use_fallback: boolean;
  use_variants?: boolean;
  variants_dir: string;
  skip_build?: boolean;
  upstream_version?: string;
}

// This action should be run periodically

export const gaBumpUpstream: CommandModule<
  CliGlobalOptions,
  CliCommandOptions
> = {
  command: "bump-upstream",
  describe:
    "DEPRECATED: bump upstream and open a PR; migrate to dappnode/workflows bump-upstream",
  builder: {
    eth_provider: {
      alias: "p",
      description:
        "Specify the eth provider to use: 'remote' (default), 'infura', 'localhost:5002'",
      default: "remote",
      type: "string"
    },
    use_fallback: {
      alias: "f",
      description:
        "Use fallback eth provider if main provider fails: false (default), true. If main provider fails, it will try to use 'remote' first and then 'infura'",
      default: true,
      type: "boolean"
    },
    use_variants: {
      alias: "use-variants",
      description: "Ignored: package variants are detected automatically",
      type: "boolean"
    },
    variants_dir: {
      description: `Directory containing package variant manifests, detected automatically (default: ${defaultVariantsDirName})`,
      type: "string",
      default: defaultVariantsDirName
    },
    upstream_version: {
      description:
        "Explicit upstream release tag or version (single upstream only)",
      type: "string"
    },
    skip_build: {
      description: `Only create the bump PR without building the package`,
      type: "boolean"
    }
  },
  handler: async (args): Promise<void> => await gaBumpUpstreamHandler(args)
};

async function gaBumpUpstreamHandler({
  dir = defaultDir,
  eth_provider: userEthProvider,
  use_fallback: useFallback,
  use_variants: useVariants,
  variants_dir: variantsDir,
  skip_build: skipBuild,
  upstream_version: explicitVersion
}: CliCommandOptions): Promise<void> {
  printBumpDeprecation();
  if (useVariants !== undefined)
    console.log(
      "--use_variants is ignored; variants are detected automatically"
    );
  // Variants are detected from the manifests in variantsDir
  const allVariants = !getPackageManifestDirs(dir, variantsDir).includes(dir);

  const { upstreamSettings, resolvedUpstreams, gitSettings, ethProvider } =
    await getInitialSettings({
      dir,
      userEthProvider,
      useFallback,
      explicitVersion
    });
  if (!upstreamSettings) {
    console.log("There are no upstream repos/versions defined in the manifest");
    return;
  }

  if (
    upstreamSettings.every(
      ({ manifestVersion, githubVersion }) => manifestVersion === githubVersion
    )
  ) {
    console.log("All versions are up-to-date");
    return;
  }

  printSettings(upstreamSettings, gitSettings, ethProvider);

  const githubSettings = await getGithubSettings(dir, upstreamSettings);
  const { branchName, repo } = githubSettings;
  if (!(await isBranchNew({ branchName, repo, dir }))) {
    if (!(await branchNeedsPr({ repo, branchName }))) {
      // The PR was already opened
      console.log(`Branch ${branchName} already exists`);
      return;
    }
    // An earlier run pushed the branch but could not open its PR. Recover it,
    // then close old PRs and build from it like a freshly pushed branch.
    console.log(`Branch ${branchName} exists without a PR, recovering it`);
    await recoverBumpBranch({
      dir,
      branchName,
      skipCommit: Boolean(process.env.SKIP_COMMIT),
      openPr: () =>
        attemptToOpenPR({
          commitMsg: createCommitMessage(upstreamSettings),
          upstreamSettings,
          githubSettings
        })
    });
  } else {
    const plan = await planPackageEdits({
      dir,
      variantsDir,
      upstreams: resolvedUpstreams,
      nextPackageVersion: packageDir =>
        getNewManifestVersion({ dir: packageDir, ethProvider })
    });
    writePlan(plan);

    await prepareAndCommitChanges({
      dir,
      gitSettings,
      upstreamSettings,
      githubSettings
    });
  }

  try {
    await closeOldPrs(repo, branchName);
  } catch (e) {
    console.warn("Could not close old linked PRs", e);
  }

  if (skipBuild) {
    console.log("Skipping build and comment stage due to --skip_build flag");
    return;
  }

  const gitHead = await getGitHead(dir);
  await buildAndComment({
    dir,
    commitSha: gitHead.commit,
    branch: branchName,
    all_variants: allVariants,
    variants_dir_name: variantsDir
  });
}

async function getNewManifestVersion({
  ethProvider,
  dir
}: {
  ethProvider: string;
  dir: string;
}): Promise<string> {
  try {
    const {
      manifest: { name }
    } = readManifest([{ dir }]);

    return await getNextVersionFromApm({
      type: "patch",
      ethProvider,
      ensName: name
    });
  } catch (e) {
    if (e.message.includes("NOREPO")) {
      console.log("Package not found in APM (probably not published yet)");
      console.log("Manifest version set to default 0.1.0");
      return "0.1.0";
    } else {
      e.message = `Error getting next version from apm: ${e.message}`;
      throw e;
    }
  }
}

async function prepareAndCommitChanges({
  dir,
  gitSettings,
  upstreamSettings,
  githubSettings
}: {
  dir: string;
  gitSettings: GitSettings;
  upstreamSettings: UpstreamSettings[];
  githubSettings: GithubSettings;
}) {
  const { branchName, branchRef } = githubSettings;
  const commitMsg = createCommitMessage(upstreamSettings);

  console.log(`commitMsg: ${commitMsg}`);

  if (process.env.SKIP_COMMIT) {
    console.log("SKIP_COMMIT=true");
    return;
  }

  await configureGitUser(gitSettings, dir);
  await checkoutNewBranch(branchName, dir);
  await commitAndPushChanges({ commitMsg, branchRef, dir });
  await attemptToOpenPR({ commitMsg, upstreamSettings, githubSettings });
}

function createCommitMessage(upstreamSettings: UpstreamSettings[]): string {
  return `bump ${upstreamSettings
    .flatMap(({ repo, githubVersion }) => `${repo} to ${githubVersion}`)
    .join(", ")}`;
}

async function configureGitUser(
  { userName, userEmail }: GitSettings,
  dir: string
) {
  await shell(["git", "config", "user.name", userName], { cwd: dir });
  await shell(["git", "config", "user.email", userEmail], { cwd: dir });
}

async function checkoutNewBranch(branchName: string, dir: string) {
  await shell(["git", "check-ref-format", "--branch", branchName], {
    cwd: dir
  });
  await shell(["git", "checkout", "-b", branchName], { cwd: dir });
}

async function commitAndPushChanges({
  dir,
  commitMsg,
  branchRef
}: {
  dir: string;
  commitMsg: string;
  branchRef: string;
}) {
  await shell(["git", "commit", "-a", "-m", commitMsg], {
    pipeToMain: true,
    cwd: dir
  });
  await shell(["git", "push", "-u", "origin", branchRef], {
    pipeToMain: true,
    cwd: dir
  });
}

async function attemptToOpenPR({
  commitMsg,
  upstreamSettings,
  githubSettings: { repo, repoData, branchName }
}: {
  commitMsg: string;
  upstreamSettings: UpstreamSettings[];
  githubSettings: GithubSettings;
}) {
  // Skip PR creation for testing
  if (process.env.ENVIRONMENT === "TEST") return;

  await repo.openPR({
    from: branchName,
    to: repoData.default_branch,
    title: commitMsg,
    body: getBumpPrBody(upstreamSettings)
  });
}
