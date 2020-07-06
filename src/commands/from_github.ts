import path from "path";
import got from "got";
import cliProgress from "cli-progress";
import { BuilderCallback } from "yargs";
import chalk from "chalk";
import inquirer from "inquirer";
import { CliGlobalOptions } from "../types";
import { contentHashFile, releaseFiles } from "../params";
import { ipfsAddDirFromUrls } from "../utils/ipfs/ipfsAddDirFromUrls";
import { getInstallDnpLink } from "../utils/getLinks";
import { verifyIpfsConnection } from "../utils/verifyIpfsConnection";
import { githubGetReleases } from "../utils/githubGetReleases";

export const command = "from_github [repoSlug]";

export const describe =
  "Gets an existing DNP Github release (assets) and upload it to IPFS. Only supports directory type releases";

interface CliCommandOptions {
  repoSlug: string;
  provider: string;
  latest: boolean;
}

export const builder: BuilderCallback<CliCommandOptions, unknown> = yargs =>
  yargs
    .positional("repoSlug", {
      description:
        "Github repo slug to fetch releases from, i.e. 'dappnode/DNP_VPN'",
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
    .require("repoSlug");

export const handler = async ({
  repoSlug,
  provider,
  latest
}: CliCommandOptions & CliGlobalOptions): Promise<void> => {
  // Parse options
  const ipfsProvider = provider;

  await verifyIpfsConnection(ipfsProvider);

  const releases = await githubGetReleases(repoSlug);

  // Pick version interactively
  const release = latest
    ? releases[0]
    : await inquirer
        .prompt([
          {
            type: "list",
            name: "name",
            message: "which version to upload?",
            choices: releases.map(r => r.name)
          }
        ])
        .then(res => releases.find(r => r.name === res.name));
  if (!release) throw Error(`release not defined`);

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
