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
      await github.deleteReleaseAndAssets(tag);

      const hashesDir = path.join(process.cwd(), "content_hashes");

      writeContentHashesToDir({ hashesDir, releaseDetailsMap });

      task.output = `Creating release for tag ${tag}...`;
      await github.createReleaseWithAssets(tag, {
        body: await getReleaseBody({ releaseDetailsMap }),
        prerelease: true, // Until it is actually published to mainnet
        assetsDir: hashesDir
      });

      // Remove the hashes dir
      try {
        fs.rmdirSync(hashesDir);
      } catch (e) {
        console.error(`Error removing hashes dir ${hashesDir}`, e);
      }
    }
  };
}

/**
 * Plain text file which should contain the IPFS hash of the release
 * Necessary for the installer script to fetch the latest content hash
 * of the eth clients. The resulting hashes are used by the DAPPMANAGER
 * to install an eth client when the user does not want to use a remote node
 */
async function writeContentHashesToDir({
  hashesDir,
  releaseDetailsMap
}: {
  hashesDir: string;
  releaseDetailsMap: ReleaseDetailsMap;
}) {
  if (!fs.existsSync(hashesDir)) {
    fs.mkdirSync(hashesDir);
  }

  for (const [dnpName, { releaseMultiHash }] of Object.entries(releaseDetailsMap)) {

    const shortDnpName = dnpName.split(".")[0];

    const contentHashPath = path.join(hashesDir, `${contentHashFileName}_${shortDnpName}`);

    try {
      fs.writeFileSync(contentHashPath, releaseMultiHash);
    } catch (e) {
      console.error(`Error writing content hash to ${contentHashPath}`, e);
    }
  }
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
