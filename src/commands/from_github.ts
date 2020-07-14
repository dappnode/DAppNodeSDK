import path from "path";
import got from "got";
import cliProgress from "cli-progress";
import { BuilderCallback } from "yargs";
import chalk from "chalk";
import inquirer from "inquirer";
import moment from "moment";
import { CliGlobalOptions } from "../types";
import { contentHashFile, releaseFiles } from "../params";
import { ipfsAddDirFromUrls } from "../utils/ipfs/ipfsAddDirFromUrls";
import { getInstallDnpLink } from "../utils/getLinks";
import { verifyIpfsConnection } from "../utils/verifyIpfsConnection";
import { githubGetReleases, GithubRelease } from "../utils/githubGetReleases";

export const command = "from_github [repoSlug]";

export const describe =
  "Gets an existing DNP Github release (assets) and upload it to IPFS";

interface CliCommandOptions {
  repoSlug: string;
  provider: string;
  latest?: boolean;
  version?: string;
}

export const builder: BuilderCallback<CliCommandOptions, unknown> = yargs =>
  yargs
    .positional("repoSlug", {
      description: `Github repo slug to fetch releases from: "dappnode/DNP_VPN", "vpn"`,
      type: "string"
    })
    .option("p", {
      alias: "provider",
      description: `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`,
      default: "dappnode"
    })
    .option("latest", {
      description: "Fetch the latest release only, even if it's a prerelease",
      type: "boolean"
    })
    .option("version", {
      description: `Fetch a given version: v0.2.5`,
      type: "string"
    })
    .require("repoSlug");

export const handler = async ({
  repoSlug,
  provider,
  latest,
  version
}: CliCommandOptions & CliGlobalOptions): Promise<void> => {
  // Parse options
  const ipfsProvider = provider;
  // Assume incomplete repo slugs refer to DAppNode core packages
  if (!repoSlug.includes("/")) repoSlug = `dappnode/DNP_${repoSlug}`;

  await verifyIpfsConnection(ipfsProvider);

  // Pick version interactively
  const release = await getSelectedGithubRelease({ repoSlug, latest, version });

  // Sanity check, make sure this release is an actual DAppNode Package
  for (const file of Object.values(releaseFiles))
    if (
      file.required &&
      !release.assets.some(asset => file.regex.test(asset.name))
    )
      throw Error(`Release assets do not contain required file ${file.id}`);

  const files = release.assets
    .filter(asset => asset.name !== contentHashFile)
    .map(asset => ({
      filepath: path.join("release", asset.name),
      url: asset.browser_download_url,
      name: asset.name,
      size: asset.size
    }));

  // Multiline download > upload progress feedback
  const multibarDnl = new cliProgress.MultiBar({
    format: "[{bar}] {percentage}%\t| {name}"
  });
  const bars = new Map<string, cliProgress.SingleBar>();
  for (const { filepath, size, name } of files) {
    bars.set(filepath, multibarDnl.create(size, 0, { name }));
  }

  function onProgress(filepath: string, bytes: number) {
    const bar = bars.get(filepath);
    if (bar) bar.increment(bytes);
  }

  const releaseMultiHash = await ipfsAddDirFromUrls(
    files,
    ipfsProvider,
    onProgress
  );

  multibarDnl.stop();

  console.log(
    chalk.green(`\nGithub release ${repoSlug} ${release.name} uploaded to IPFS`)
  );

  // Verify that the resulting release hash matches the one in Github
  const contentHashAsset = release.assets.find(
    asset => asset.name === contentHashFile
  );
  if (contentHashAsset) {
    const contentHash = await got(contentHashAsset.browser_download_url).text();
    if (contentHash.trim() === releaseMultiHash) {
      console.log(chalk.dim("✓ Release hash verified, matches Github's"));
    } else {
      console.log(`${chalk.red("WARNING!")} resulting hashes do not match`);
      console.log(`Github release: ${contentHash}`);
    }
  }

  console.log(`Release hash : ${releaseMultiHash}`);
  console.log(getInstallDnpLink(releaseMultiHash));
};

/**
 * Given user options, choose a Github Release to get
 * @param param0
 */
async function getSelectedGithubRelease({
  repoSlug,
  latest,
  version
}: {
  repoSlug: string;
  latest?: boolean;
  version?: string;
}): Promise<GithubRelease> {
  const releases = await githubGetReleases(repoSlug);
  if (releases.length === 0) throw Error(`${repoSlug} has no releases`);

  if (latest) {
    return releases[0];
  }

  if (version) {
    const release = releases.find(r => r.name === version);
    if (!release) {
      const releaseList = releases.map(r => r.name).join(",");
      throw Error(
        `No release found for version ${version}. Available releases: ${releaseList}`
      );
    }
    return release;
  }

  // Prompt for a specific version
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "name",
      message: "which Github release to get?",
      choices: releases.map(release => ({
        name: prettyReleaseText(release),
        value: release.name
      }))
    }
  ]);
  const chosenRelease = releases.find(r => r.name === answers.name);
  if (!chosenRelease) throw Error(`chosenRelease ${answers.name} not found`);
  return chosenRelease;
}

/**
 * Print relevant information about a Github release
 * @param release
 */
function prettyReleaseText(release: GithubRelease): string {
  const parts: string[] = [
    release.name,
    moment(release.published_at).fromNow()
  ];
  if (release.prerelease) parts.push("(prerelease)");
  return parts.join(" ");
}
