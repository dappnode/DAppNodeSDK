import fs from "fs";
import path from "path";
import Listr, { ListrTask } from "listr";
import rimraf from "rimraf";
import { readManifest, writeManifest } from "../utils/manifest";
import { validateManifest } from "../utils/validateManifest";
import { verifyAvatar } from "../utils/verifyAvatar";
import { copyReleaseFile } from "../utils/copyReleaseFile";
import { addReleaseRecord } from "../utils/releaseRecord";
import {
  releaseFiles,
  CliError,
  getImageFilename,
  getLegacyImageFilename,
  releaseFilesDefaultNames
} from "../params";
import {
  readCompose,
  writeCompose,
  parseComposeUpstreamVersion,
  updateComposeImageTags,
  getComposePackageImages,
  getComposePath,
  composeDeleteBuildProperties
} from "../utils/compose";
import {
  Architecture,
  defaultArch,
  ListrContextBuildAndPublish
} from "../types";
import { parseTimeout } from "../utils/timeout";
import { buildWithBuildx } from "./buildWithBuildx";
import { buildWithCompose } from "./buildWithCompose";
import { parseArchitectures } from "../utils/parseArchitectures";
import { pruneCache } from "../utils/cache";
import { getArchitecture } from "../utils/getArchitecture";
import { getGitHead, getGitHeadIfAvailable } from "../utils/git";
import { fetchPinsWithBranchToDelete, getPinMetadata } from "../pinStrategy";
import { PinataPinManager } from "../providers/pinata/pinManager";
import { PinKeyvaluesDefault } from "../releaseUploader/pinata";
import {
  getReleaseUploader,
  ReleaseUploaderConnectionError,
  cliArgsToReleaseUploaderProvider,
  UploadTo
} from "../releaseUploader";
import { saveAndCompressImagesCached } from "./saveAndCompressImages";

// Pretty percent uploaded reporting
const percentToMessage = (percent: number) =>
  `Uploading... ${(percent * 100).toFixed(2)}%`;

export function buildAndUpload({
  buildDir,
  contentProvider,
  uploadTo,
  userTimeout,
  skipSave,
  skipUpload,
  requireGitData,
  deleteOldPins,
  composeFileName,
  dir
}: {
  buildDir: string;
  contentProvider: string;
  uploadTo: UploadTo;
  userTimeout?: string;
  skipSave?: boolean;
  skipUpload?: boolean;
  requireGitData?: boolean;
  deleteOldPins?: boolean;
  composeFileName: string;
  dir: string;
}): ListrTask<ListrContextBuildAndPublish>[] {
  const buildTimeout = parseTimeout(userTimeout);

  // Load manifest #### Todo: Deleted check functions. Verify manifest beforehand
  const { manifest, format } = readManifest({ dir });

  // Make sure the release is of correct type
  if ((manifest as any).image)
    throw new CliError(`
DAppNode packages expect all docker related data to be contained only
in the docker-compose.yml. Please translate the settings in 'manifest.image'
to your package's docker-compose.yml and then delete the 'manifest.image' prop.
`);
  if (manifest.avatar)
    throw new CliError(`
DAppNode packages expect the avatar to be located at the root folder as a file
and not declared in the manifest. Please add your package avatar to this directory
as ${releaseFilesDefaultNames.avatar} and then remove the 'manifest.avatar' property.
`);

  // Define variables from manifest
  const { name, version } = manifest;
  if (/[A-Z]/.test(name))
    throw new CliError("Package name in the manifest must be lowercase");

  // Update compose
  const composePath = getComposePath({ dir, composeFileName });
  const composeForDev = readCompose({ dir, composeFileName });
  const composeForBuild = updateComposeImageTags(composeForDev, manifest);
  const composeForRelease = updateComposeImageTags(composeForDev, manifest, {
    editExternalImages: true
  });

  // Get external image tags to pull and re-tag
  const images = getComposePackageImages(composeForDev, manifest);

  const useBuildx = manifest.architectures !== undefined;
  const architectures = manifest.architectures
    ? parseArchitectures(manifest.architectures)
    : [defaultArch];

  /** Returns image destination full path based on architecture */
  function getImageDestPath(architecture: Architecture): string {
    return path.join(buildDir, getImageFilename(name, version, architecture));
  }

  // Bump upstreamVersion if provided
  const upstreamVersion =
    parseComposeUpstreamVersion(composeForDev) || process.env.UPSTREAM_VERSION;
  if (upstreamVersion) manifest.upstreamVersion = upstreamVersion;

  // Release upload. Use function for return syntax
  const releaseUploaderProvider = cliArgsToReleaseUploaderProvider({
    uploadTo,
    contentProvider
  });
  const releaseUploader = getReleaseUploader(releaseUploaderProvider);

  return [
    {
      title: "Verify connection",
      skip: () => skipUpload,
      task: async () => {
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
    },

    {
      title: "Create release dir",
      task: async () => {
        // Create dir
        fs.mkdirSync(buildDir, { recursive: true }); // Ok on existing dir
        const buildFiles = fs.readdirSync(buildDir);

        const imageFilenames = architectures.map(arch =>
          getImageFilename(name, version, arch)
        );

        // Clean all files except the expected target images
        for (const filepath of buildFiles)
          if (!imageFilenames.includes(filepath))
            rimraf.sync(path.join(buildDir, filepath));
      }
    },

    // Files should be copied for any type of release so they are available
    // in Github releases
    {
      title: "Copy files and validate",
      task: async () => {
        // Write compose with build props for builds
        writeCompose(composeForBuild, { dir, composeFileName });

        // Copy files for release dir
        writeCompose(composeForRelease, { dir: buildDir, composeFileName });
        writeManifest(manifest, format, { dir: buildDir });
        validateManifest(manifest);

        // Copy all other release files
        for (const [fileId, fileConfig] of Object.entries(releaseFiles)) {
          switch (fileId as keyof typeof releaseFiles) {
            case "manifest":
            case "compose":
              continue; // Hanlded above
            default:
              copyReleaseFile({
                fileConfig: { ...fileConfig, id: fileId },
                fromDir: dir,
                toDir: buildDir
              });
          }
        }

        // Verify avatar (throws)
        const avatarPath = path.join(buildDir, releaseFilesDefaultNames.avatar);
        verifyAvatar(avatarPath);

        // Make sure git data is available before doing a long build
        await getGitHeadIfAvailable({ requireGitData });
      }
    },

    // NOTE: The naming scheme for multiarch exported images must be
    // compatible with DAppNodes that expect a single ".tar.xz" file
    // which must be amd64, x86_64
    // const imageEntry = files.find(file => /\.tar\.xz$/.test(file));
    ...architectures.map(
      (architecture): ListrTask<ListrContextBuildAndPublish> => ({
        title: `Build architecture ${architecture}`,
        task: () =>
          new Listr([
            ...(useBuildx
              ? buildWithBuildx({
                  architecture,
                  images,
                  composePath,
                  buildTimeout
                })
              : buildWithCompose({
                  composePath,
                  buildTimeout
                })),

            // Save images once per architecture, since the image tag is the same?
            ...saveAndCompressImagesCached({
              images,
              architecture,
              destPath: getImageDestPath(architecture),
              buildTimeout,
              skipSave
            })
          ])
      })
    ),

    {
      title: `Upload release to ${releaseUploader.networkName}`,
      skip: () => skipUpload,
      task: async (ctx, task) => {
        // get the architecture of the machine where is executed the dappnodesdk
        const architectureHost = getArchitecture();
        const imageHostArchPath = getImageDestPath(architectureHost);
        const imageLegacyPath = path.join(
          buildDir,
          getLegacyImageFilename(name, version)
        );

        // Legacy code for backwards compatibility.
        // Old DAppNodes expect a single linux/amd64 image at a different path than `getImageDestPath()`.
        if (fs.existsSync(imageHostArchPath))
          fs.copyFileSync(imageHostArchPath, imageLegacyPath);

        const gitHead = await getGitHeadIfAvailable({ requireGitData });

        // Remove `build` property AFTER building. Otherwise it may break ISO installations
        // https://github.com/dappnode/DAppNode_Installer/issues/161
        composeDeleteBuildProperties({ dir: buildDir, composeFileName });

        ctx.releaseHash = await releaseUploader.addFromFs({
          dirPath: buildDir,
          metadata: getPinMetadata(manifest, gitHead) as PinKeyvaluesDefault,
          onProgress: percent => (task.output = percentToMessage(percent))
        });
      }
    },

    {
      title: "Delete old pins",
      enabled: () => Boolean(deleteOldPins),
      task: async (_, task) => {
        const gitHead = await getGitHead();
        if (releaseUploaderProvider.type !== "pinata")
          throw Error("Must use pinata for deleteOldPins");

        // Unpin items on the same branch but previous (ancestor) commits
        const pinata = new PinataPinManager(releaseUploaderProvider);
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
    },

    {
      title: "Save upload results",
      task: async ctx => {
        addReleaseRecord({
          dir,
          version,
          hash: ctx.releaseHash,
          to: contentProvider
        });

        // "return" result for next tasks
        ctx.releaseMultiHash = ctx.releaseHash;

        try {
          await pruneCache();
        } catch (e) {
          console.error("Error on pruneCache", e);
        }
      }
    }
  ];
}
