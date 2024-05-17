import path from "path";
import fs from "fs";
import { Github } from "../../../providers/github/Github.js";
import { ListrContextPublish, TxData } from "../../../types.js";
import { ListrTask } from "listr";
import {
  compactManifestIfCore,
  composeDeleteBuildProperties
} from "../../../files/index.js";
import {
  getInstallDnpLink,
  getPublishTxLink
} from "../../../utils/getLinks.js";
import { getNextGitTag } from "../getNextGitTag.js";
import { contentHashFile } from "../../../params.js";
import { ReleaseDetailsMap } from "../types.js";
import { buildReleaseDetailsMap } from "../buildReleaseDetailsMap.js";

/**
 * Create release
 *  nextVersion comes from the first task in `publish`
 *  buildDir comes from the first task in `publish`
 */
export function getCreateReleaseTask({
  github,
  composeFileName
}: {
  github: Github;
  composeFileName?: string;
}): ListrTask<ListrContextPublish> {
  return {
    title: `Create release`,
    task: async (ctx, task) => {
      const releaseDetailsMap = buildReleaseDetailsMap(ctx);

      const tag = getNextGitTag(releaseDetailsMap);

      task.output = "Deleting existing release...";
      await github.deteleReleaseAndAssets(tag);

      const contentHashPaths = await handleReleaseVariantFiles({
        releaseDetailsMap,
        composeFileName
      });

      task.output = `Creating release for tag ${tag}...`;
      await github.createReleaseAndUploadAssets(tag, {
        body: await getReleaseBody({ releaseDetailsMap, tag, github }),
        prerelease: true, // Until it is actually published to mainnet
        // assetsDir: buildDir, // TODO: Fix
        ignorePattern: /\.tar\.xz$/ // To ignore legacy .tar.xz image
      });

      // Clean content hash file so the directory uploaded to IPFS is the same
      // as the local build_* dir. User can then `ipfs add -r` and get the same hash
      contentHashPaths.map(contentHashPath => fs.unlinkSync(contentHashPath));
    }
  };
}

async function handleReleaseVariantFiles({
  releaseDetailsMap,
  composeFileName
}: {
  releaseDetailsMap: ReleaseDetailsMap;
  composeFileName?: string;
}): Promise<string[]> {
  const contentHashPaths: string[] = [];

  for (const [, { variant, releaseDir, releaseMultiHash }] of Object.entries(
    releaseDetailsMap
  )) {
    if (!releaseMultiHash) {
      throw new Error(
        `Release hash not found for variant ${variant} of ${name}`
      );
    }

    const contentHashPath = writeContentHashToFile({
      releaseDir,
      releaseMultiHash
    });

    contentHashPaths.push(contentHashPath);

    compactManifestIfCore(releaseDir);
    composeDeleteBuildProperties({ dir: releaseDir, composeFileName });
  }

  return contentHashPaths;
}

/**
 * Plain text file which should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 */
function writeContentHashToFile({
  releaseDir,
  releaseMultiHash
}: {
  releaseDir: string;
  releaseMultiHash: string;
}): string {
  const contentHashPath = path.join(releaseDir, contentHashFile);
  fs.writeFileSync(contentHashPath, releaseMultiHash);
  return contentHashPath;
}

/**
 * Write the release body
 *
 */
async function getReleaseBody({
  releaseDetailsMap,
  tag,
  github
}: {
  releaseDetailsMap: ReleaseDetailsMap;
  tag: string;
  github: Github;
}) {
  return `
  <!-- Set :heavy_check_mark: to the packages that have already been published -->

  ## Package versions

  ${getPackageVersionsTable(releaseDetailsMap)}

  ${await github.generateReleaseNotes(tag)}

  `.trim();
}

/*
  ${/*Object.entries(releaseDetailsMap)
    .map(([dnpName, { nextVersion, releaseMultiHash, txData }]) =>
      getReleaseDetailsForDnpName({
        dnpName,
        nextVersion,
        releaseMultiHash,
        txData
      })
    )
  .join("\n\n")}
*/

function getPackageVersionsTable(releaseDetailsMap: ReleaseDetailsMap) {
  return `
  Package | Version | Hash | Install link | Publish link | Published
  --- | --- | --- | --- | --- | ---
  ${Object.entries(releaseDetailsMap)
    .map(([dnpName, { nextVersion, releaseMultiHash, txData }]) =>
      getPackageVersionsRow({
        dnpName,
        nextVersion,
        releaseMultiHash,
        txData
      })
    )
    .join("\n")}
  `.trim();
}

function getPackageVersionsRow({
  dnpName,
  nextVersion,
  releaseMultiHash,
  txData
}: {
  dnpName: string;
  nextVersion: string;
  releaseMultiHash: string;
  txData: TxData;
}): string {
  const prettyDnp = prettyDnpName(dnpName);

  return `
  ${prettyDnp} | ${nextVersion} | \`${releaseMultiHash}\` | [Install ${prettyDnp}](${getInstallDnpLink(
    releaseMultiHash
  )}) | [Publish ${prettyDnp}](${getPublishTxLink(txData)}) | :x:
  `.trim();
}

/**
 * Pretifies a ENS name
 * "bitcoin.dnp.dappnode.eth" => "Bitcoin"
 * "raiden-testnet.dnp.dappnode.eth" => "Raiden Testnet"
 *
 * TODO: This is duplicated from dappmanager
 *
 * @param name ENS name
 * @returns pretty name
 */
function prettyDnpName(dnpName: string): string {
  if (!dnpName || typeof dnpName !== "string") return dnpName;
  return (
    dnpName
      .split(".")[0]
      // Convert all "-" and "_" to spaces
      .replace(new RegExp("-", "g"), " ")
      .replace(new RegExp("_", "g"), " ")
      .split(" ")
      .map(capitalize)
      .join(" ")
  );
}

/**
 * Capitalizes a string
 * @param string = "hello world"
 * @returns "Hello world"
 *
 * TODO: This is duplicated from dappmanager
 */
function capitalize(s: string): string {
  if (!s || typeof s !== "string") return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/*
function getReleaseDetailsForDnpName({
  dnpName,
  nextVersion,
  releaseMultiHash,
  txData
}: {
  dnpName: string;
  nextVersion?: string;
  releaseMultiHash?: string;
  txData?: TxData;
}): string {
  if (!nextVersion || !releaseMultiHash || !txData) {
    return ""; // TODO: Throw error?
  }

  return `
  <details><summary><b>${dnpName}</b></summary>
  <p>

    Version: ${nextVersion}
    Hash: \`${releaseMultiHash}\`
    <a href=${getInstallDnpLink(releaseMultiHash)}>Install</a>
    <a href=${getPublishTxLink(txData)}>Publish</a>

  </p>
  </details>
  `;
}
*/
