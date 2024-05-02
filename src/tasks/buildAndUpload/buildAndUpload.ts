import fs from "fs";
import path from "path";
import { ListrTask } from "listr/index.js";
import rimraf from "rimraf";
import { verifyAvatar } from "../../utils/verifyAvatar.js";
import { copyReleaseFile } from "../../utils/copyReleaseFile.js";
import { addReleaseRecord } from "../../utils/releaseRecord.js";
import { CliError, defaultVariantsDir, releaseFilesDefaultNames } from "../../params.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import { parseTimeout } from "../../utils/timeout.js";
import { buildWithBuildx } from "./buildWithBuildx.js";
import { buildWithCompose } from "./buildWithCompose.js";
import { pruneCache } from "../../utils/cache.js";
import { getGitHead, getGitHeadIfAvailable } from "../../utils/git.js";
import {
  fetchPinsWithBranchToDelete,
  getPinMetadata
} from "../../pinStrategy/index.js";
import { PinataPinManager } from "../../providers/pinata/pinManager.js";
import { PinKeyvaluesDefault } from "../../releaseUploader/pinata/index.js";
import {
  getReleaseUploader,
  ReleaseUploaderConnectionError,
  cliArgsToReleaseUploaderProvider,
  IReleaseUploader,
  ReleaseUploaderProvider
} from "../../releaseUploader/index.js";
import {
  validateComposeSchema,
  validateManifestSchema,
  validateSetupWizardSchema,
  validateDappnodeCompose
} from "@dappnode/schemas";
import {
  composeDeleteBuildProperties,
  writeManifest,
  readSetupWizardIfExists
} from "../../files/index.js";
import { Architecture, Manifest, releaseFiles } from "@dappnode/types";
import { getImageFileName } from "../../utils/getImageFileName.js";
import { BuildAndUploadOptions, VariantsMap, VariantsMapEntry } from "./types.js";
import { buildVariantMap } from "./buildVariantMap.js";
import { validateManifests } from "./validation.js";
import { writeBuildCompose, writeReleaseCompose } from "./utils.js";

export function buildAndUpload({
  contentProvider,
  uploadTo,
  userTimeout,
  skipSave,
  skipUpload,
  requireGitData,
  deleteOldPins,
  composeFileName,
  dir,
  variantsDirPath = defaultVariantsDir,
  variants,
}: BuildAndUploadOptions): ListrTask<ListrContextBuildAndPublish>[] {
  const buildTimeout = parseTimeout(userTimeout);

  // Release upload. Use function for return syntax
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo,
    contentProvider
  });
  const releaseUploader = getReleaseUploader(releaseUploaderProvider);

  const variantsMap = buildVariantMap({
    variants,
    rootDir: dir,
    variantsDirPath,
    composeFileName
  });

  validateManifests(variantsMap);

  return [
    {
      title: "Verify connection",
      skip: () => skipUpload,
      task: () => verifyConnection(releaseUploader)
    },
    getReleaseDirCreationTask({ variantsMap }),
    getFileValidationTask({ variantsMap, rootDir: dir }),
    getFileCopyTask({ variantsMap, rootDir: dir, composeFileName, requireGitData }),
    ...getBuildTasks({ variantsMap, buildTimeout, skipSave }),
    ...getUploadTasks({ variantsMap, releaseUploader, requireGitData: !!requireGitData, composeFileName, skipUpload }),
    getDeleteOldPinsTask({ variantsMap, deleteOldPins: !!deleteOldPins, releaseUploaderProvider }),
    getSaveUploadResultsTask({ variantsMap, rootDir: dir, contentProvider })
  ];
}

async function verifyConnection(releaseUploader: IReleaseUploader): Promise<void> {
  try {
    await releaseUploader.testConnection();
  } catch (e) {
    if (e instanceof ReleaseUploaderConnectionError) {
      throw new CliError(
        `Can't connect to ${e.ipfsProvider}: ${e.reason}. ${e.help || ""}`
      );
    } else {
      throw e;
    }
  }
}

function getReleaseDirCreationTask({ variantsMap }: { variantsMap: VariantsMap }): ListrTask<ListrContextBuildAndPublish> {

  return {
    title: `Create release directories`,
    task: () => createReleaseDirs({ variantsMap })
  };
}

function createReleaseDirs({ variantsMap }: { variantsMap: VariantsMap }): void {

  for (const [, { manifest, releaseDir, architectures }] of Object.entries(variantsMap)) {

    console.log(`Creating release directory for ${manifest.name} (version ${manifest.version}) at ${releaseDir}`);

    fs.mkdirSync(releaseDir, { recursive: true }); // Ok on existing dir
    const releaseFiles = fs.readdirSync(releaseDir);

    const imagePaths = architectures.map(arch => getImageFileName(manifest.name, manifest.version, arch));

    // Clean all files except the expected target images
    for (const filepath of releaseFiles)
      if (!imagePaths.includes(filepath))
        rimraf.sync(path.join(releaseDir, filepath));
  }
}

function getFileValidationTask({ variantsMap, rootDir }: { variantsMap: VariantsMap, rootDir: string }): ListrTask<ListrContextBuildAndPublish> {

  return {
    title: `Validate files`,
    task: async () => await validatePackageFiles({ variantsMap, rootDir })
  };
}

async function validatePackageFiles({ variantsMap, rootDir }: { variantsMap: VariantsMap, rootDir: string }): Promise<void> {

  const setupWizard = readSetupWizardIfExists(rootDir);

  if (setupWizard)
    validateSetupWizardSchema(setupWizard);

  for (const [, { manifest, compose, rootComposePath: composePath, variantComposePath }] of Object.entries(variantsMap)) {

    console.log(`Validating files for ${manifest.name} (version ${manifest.version})`);

    const composePaths = [composePath, ...(variantComposePath ? [variantComposePath] : [])];

    for (const [fileId] of Object.entries(releaseFiles)) {
      switch (fileId as keyof typeof releaseFiles) {
        case "manifest":
          validateManifestSchema(manifest);
          break;
        case "compose":
          // validate against official docker compose schema.
          await validateComposeSchema(composePaths);

          // validate against custom dappnode requirements
          validateDappnodeCompose(compose, manifest);
          break;
      }
    }
  }
}

function getFileCopyTask({ variantsMap, rootDir, composeFileName, requireGitData }: { variantsMap: VariantsMap, rootDir: string, composeFileName: string, requireGitData?: boolean }): ListrTask<ListrContextBuildAndPublish> {

  return {
    title: "Copy files to release directory",
    task: async () => copyFilesToReleaseDir({ variantsMap, rootDir, composeFileName, requireGitData })
  };
}

async function copyFilesToReleaseDir({ variantsMap, rootDir, composeFileName, requireGitData }: { variantsMap: VariantsMap, rootDir: string, composeFileName: string, requireGitData?: boolean }): Promise<void> {

  for (const [, { manifest, manifestFormat, releaseDir, compose }] of Object.entries(variantsMap)) {

    console.log(`Copying files for ${manifest.name} (version ${manifest.version})`);

    for (const [fileId, fileConfig] of Object.entries(releaseFiles)) {
      switch (fileId as keyof typeof releaseFiles) {
        case "manifest":
          writeManifest<Manifest>(manifest, manifestFormat, { dir: releaseDir });
          break;
        case "compose":
          // Write compose with build props for builds
          writeBuildCompose({ compose, composeFileName, manifest, rootDir });

          // Copy files for release dir
          writeReleaseCompose({ compose, composeFileName, manifest, releaseDir });
          break;
        default:
          copyReleaseFile({
            fileConfig: { ...fileConfig, id: fileId },
            fromDir: rootDir,
            toDir: releaseDir
          });
      }
    }

    // Verify avatar (throws)
    const avatarPath = path.join(releaseDir, releaseFilesDefaultNames.avatar);
    verifyAvatar(avatarPath);

    // Make sure git data is available before doing a long build
    await getGitHeadIfAvailable({ requireGitData });
  }
}

/**
 * The naming scheme for multiarch exported images must be
 * compatible with DAppNodes that expect a single ".tar.xz" file
 * which must be amd64, x86_64
 * 
 * const imageEntry = files.find(file => /\.tar\.xz$/.test(file));
 */
function getBuildTasks({ variantsMap, buildTimeout, skipSave }: { variantsMap: VariantsMap, buildTimeout: number, skipSave?: boolean }): ListrTask<ListrContextBuildAndPublish>[] {

  const buildTasks: ListrTask<ListrContextBuildAndPublish>[] = [];

  for (const [, variantSpecs] of Object.entries(variantsMap)) {

    const { manifest: { name, version }, architectures } = variantSpecs;

    if (architectures) {
      buildTasks.push(...architectures.map(architecture => ({
        title: `Build ${name} (version ${version}) for arch ${architecture}`,
        task: () => buildVariantWithBuildx({ variantSpecs, architecture, buildTimeout, skipSave })
      })));
    } else {
      buildTasks.push({
        title: `Build ${name} (version ${version})`,
        task: () => buildVariantWithCompose({ variantSpecs, buildTimeout, skipSave })
      });
    }
  }

  return buildTasks;
}

function buildVariantWithBuildx({
  architecture,
  variantSpecs,
  buildTimeout,
  skipSave
}: {
  architecture: Architecture,
  variantSpecs: VariantsMapEntry,
  buildTimeout: number,
  skipSave?: boolean
}): void {

  const { manifest: { name, version }, images, rootComposePath: composePath, variantComposePath, releaseDir } = variantSpecs;

  const destPath = getImagePath({ releaseDir, name, version, architecture });

  buildWithBuildx({
    architecture,
    images,
    composePath,
    variantComposePath,
    buildTimeout,
    skipSave,
    destPath
  })
}

function buildVariantWithCompose({
  variantSpecs,
  buildTimeout,
  skipSave
}: {
  variantSpecs: VariantsMapEntry,
  buildTimeout: number,
  skipSave?: boolean
}): void {
  const { manifest: { version, name }, images, rootComposePath: composePath, variantComposePath, releaseDir } = variantSpecs;
  const destPath = getImagePath({ releaseDir, name, version });

  buildWithCompose({
    images,
    composePath,
    variantComposePath,
    buildTimeout,
    skipSave,
    destPath
  });
}

function getImagePath({
  releaseDir,
  name,
  version,
  architecture = "linux/amd64"
}: {
  releaseDir: string,
  name: string,
  version: string,
  architecture?: Architecture
}): string {
  return path.join(releaseDir, getImageFileName(name, version, architecture));
}

function getUploadTasks({ variantsMap, skipUpload, releaseUploader, requireGitData, composeFileName }: { variantsMap: VariantsMap, skipUpload?: boolean, releaseUploader: IReleaseUploader, requireGitData: boolean, composeFileName: string }): ListrTask<ListrContextBuildAndPublish>[] {
  const uploadTasks: ListrTask<ListrContextBuildAndPublish>[] = [];

  for (const [variant, { manifest, releaseDir }] of Object.entries(variantsMap)) {

    const { name: dnpName } = manifest;

    uploadTasks.push(
      {
        title: `Upload release for ${dnpName} to ${releaseUploader.networkName}`,
        skip: () => skipUpload,
        task: async (ctx, task) => {
          // TODO: Do this
          /*if (fs.existsSync(imagePathAmd))
            fs.copyFileSync(imagePathAmd, imagePathLegacy);*/

          const gitHead = await getGitHeadIfAvailable({ requireGitData });

          // Remove `build` property AFTER building. Otherwise it may break ISO installations
          // https://github.com/dappnode/DAppNode_Installer/issues/161
          composeDeleteBuildProperties({ dir: releaseDir, composeFileName });

          console.log("Variant: ", variant);

          ctx[dnpName] = ctx[dnpName] || {};

          ctx[dnpName].variant = variant;

          ctx[dnpName].releaseHash = await releaseUploader.addFromFs({
            dirPath: releaseDir,
            metadata: getPinMetadata(manifest, gitHead) as PinKeyvaluesDefault,
            onProgress: percent => (task.output = percentToMessage(percent))
          });

          // TODO: Check what is the difference between releaseHash and releaseMultiHash
          ctx[dnpName].releaseMultiHash = ctx[dnpName].releaseHash;
        }
      }
    );
  }

  return uploadTasks;
}

function getDeleteOldPinsTask({ variantsMap, deleteOldPins, releaseUploaderProvider }: { variantsMap: VariantsMap, deleteOldPins: boolean, releaseUploaderProvider: ReleaseUploaderProvider }): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Delete old pins",
    enabled: () => deleteOldPins,
    task: async (_, task) => {
      const gitHead = await getGitHead();
      if (releaseUploaderProvider.type !== "pinata")
        throw Error("Must use pinata for deleteOldPins");

      // Unpin items on the same branch but previous (ancestor) commits
      const pinata = new PinataPinManager(releaseUploaderProvider);

      for (const [, { manifest }] of Object.entries(variantsMap)) {
        const pinsToDelete = await fetchPinsWithBranchToDelete(
          pinata,
          manifest,
          gitHead
        );

        for (const pin of pinsToDelete) {
          task.output = `Unpinning previous commit ${pin.commit} ${pin.ipfsHash}`;
          await pinata.unpin(pin.ipfsHash).catch(e => {
            console.error(`Error deleting old pin ${pin.ipfsHash}`, e);
          });
        }
      }
    }
  }
}

function getSaveUploadResultsTask({ variantsMap, rootDir, contentProvider }: { variantsMap: VariantsMap, rootDir: string, contentProvider: string }): ListrTask<ListrContextBuildAndPublish> {
  return {
    title: "Save upload results",
    task: async ctx => {

      // TODO: Do not assume only one variant
      const [, { manifest: { name, version } }] = Object.entries(variantsMap)[0];

      addReleaseRecord({
        dir: rootDir,
        version,
        hash: ctx[name].releaseHash,
        to: contentProvider
      });

      try {
        await pruneCache();
      } catch (e) {
        console.error("Error on pruneCache", e);
      }
    }
  };
}

function percentToMessage(percent: number): string {
  return `Uploading... ${(percent * 100).toFixed(2)}%`;
}