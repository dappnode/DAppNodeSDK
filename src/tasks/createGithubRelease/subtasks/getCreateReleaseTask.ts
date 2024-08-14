import path from "path";
import fs from "fs";
import { Github } from "../../../providers/github/Github.js";
import { ListrContextPublish, TxData } from "../../../types.js";
import { ListrTask } from "listr";
import {
  getInstallDnpLink,
  getPublishTxLink
} from "../../../utils/getLinks.js";
import { getNextGitTag } from "../getNextGitTag.js";
import { contentHashFileName } from "../../../params.js";
import { ReleaseDetailsMap } from "../types.js";
import { buildReleaseDetailsMap } from "../buildReleaseDetailsMap.js";
import { compactManifestIfCore, composeDeleteBuildProperties } from "../../../files/index.js";

/**
 * Create release
 *  nextVersion comes from the first task in `publish`
 *  buildDir comes from the first task in `publish`
 */
export function getCreateReleaseTask({
  github,
  composeFileName,
  isMultiVariant
}: {
  github: Github;
  composeFileName?: string;
  isMultiVariant: boolean;
}): ListrTask<ListrContextPublish> {
  return {
    title: `Create release`,
    task: async (ctx, task) => {
      const releaseDetailsMap = buildReleaseDetailsMap(ctx);

      const tag = getNextGitTag(releaseDetailsMap);

      task.output = "Deleting existing release...";
      await github.deleteReleaseAndAssets(tag);

      task.output = `Creating release for tag ${tag}...`;
      const releaseId = await github.createRelease(tag, {
        body: await getReleaseBody({ releaseDetailsMap }),
        prerelease: true, // Until it is actually published to mainnet
      });

      task.output = "Preparing release directories for Github release...";
      prepareGithubReleaseFiles({ releaseDetailsMap, composeFileName });

      task.output = "Uploading assets...";
      await uploadAssets({ releaseDetailsMap, github, releaseId, isMultiVariant });

    }
  };
}

function prepareGithubReleaseFiles({
  releaseDetailsMap,
  composeFileName
}: {
  releaseDetailsMap: ReleaseDetailsMap;
  composeFileName?: string;
}) {
  for (const [, { releaseMultiHash, releaseDir }] of Object.entries(releaseDetailsMap)) {

    const contentHashPath = path.join(releaseDir, `${contentHashFileName}`);

    try {

      /**
       * Plain text file which should contain the IPFS hash of the release
       * Necessary for the installer script to fetch the latest content hash
       * of the eth clients. The resulting hashes are used by the DAPPMANAGER
       * to install an eth client when the user does not want to use a remote node
       */
      fs.writeFileSync(contentHashPath, releaseMultiHash);

      compactManifestIfCore(releaseDir);
      composeDeleteBuildProperties({ dir: releaseDir, composeFileName });

    } catch (e) {
      console.error(`Error found while preparing files in ${releaseDir} for Github release`, e);
    }
  }
}

async function uploadAssets({
  releaseDetailsMap,
  github,
  releaseId,
  isMultiVariant
}: {
  releaseDetailsMap: ReleaseDetailsMap;
  github: Github;
  releaseId: number;
  isMultiVariant: boolean;
}) {
  const releaseEntries = Object.entries(releaseDetailsMap);
  const [, { releaseDir: firstReleaseDir }] = releaseEntries[0];

  await uploadAvatar({ github, releaseId, avatarDir: firstReleaseDir });

  for (const [dnpName, { releaseDir }] of releaseEntries) {
    const shortDnpName = dnpName.split(".")[0];

    await github.uploadReleaseAssets({
      releaseId,
      assetsDir: releaseDir,
      // Only upload yml, txz and dappnode_package.json files
      matchPattern: /(.*\.ya?ml$)|(.*\.txz$)|(dappnode_package\.json)|(content-hash)/,
      fileNamePrefix: isMultiVariant ? `${shortDnpName}_` : ""
    }).catch((e) => {
      console.error(`Error uploading assets from ${releaseDir}`, e);
    });
  }
}

async function uploadAvatar({
  github,
  releaseId,
  avatarDir
}: {
  github: Github;
  releaseId: number;
  avatarDir: string;
}): Promise<void> {
  await github.uploadReleaseAssets({
    releaseId,
    assetsDir: avatarDir,
    matchPattern: /.*\.png/,
  }).catch((e) => {
    console.error(`Error uploading avatar from ${avatarDir}`, e);
  });
}


/**
 * Write the release body
 *
 */
async function getReleaseBody({
  releaseDetailsMap,
}: {
  releaseDetailsMap: ReleaseDetailsMap;
}) {
  return `
  ## Package versions

  ${getPackageVersionsTable(releaseDetailsMap)}

  `.trim();
}

function getPackageVersionsTable(releaseDetailsMap: ReleaseDetailsMap) {
  return `
  Package | Version | Hash | Install | Publish
  --- | --- | --- | --- | ---
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
  ${prettyDnp} | ${nextVersion} | \`${releaseMultiHash}\` | [:inbox_tray:](${getInstallDnpLink(
    releaseMultiHash
  )}) | [:mega:](${getPublishTxLink(txData)})
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
