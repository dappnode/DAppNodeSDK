import fs from "fs";
import path from "path";
import Listr from "listr";
import { getFileHash } from "../utils/getFileHash";
import { getImageId } from "../utils/getImageId";
import { loadCache, writeCache } from "../utils/cache";
import { readManifest, writeManifest } from "../utils/manifest";
import { validateManifest } from "../utils/validateManifest";
import { verifyAvatar } from "../utils/verifyAvatar";
import { getAssetPath, getAssetPathRequired } from "../utils/getAssetPath";
import { addReleaseRecord } from "../utils/releaseRecord";
import { releaseFiles, CliError } from "../params";
import { shell } from "../utils/shell";
import { compressFile } from "../utils/commands/compressFile";
import { ipfsAddFromFs } from "../utils/ipfs/ipfsAddFromFs";
import { swarmAddDirFromFs } from "../utils/commands/swarmAddDirFromFs";
import { updateCompose } from "../utils/compose";
import { CliGlobalOptions, ListrContextBuildAndPublish } from "../types";
import { parseTimeout } from "../utils/timeout";

// Pretty percent uploaded reporting
const percentToMessage = (percent: number) =>
  `Uploading... ${(percent * 100).toFixed(2)}%`;

export function buildAndUpload({
  buildDir,
  ipfsProvider,
  swarmProvider,
  userTimeout,
  uploadToSwarm,
  dir,
  verbose,
  silent
}: {
  buildDir: string;
  ipfsProvider: string;
  swarmProvider: string;
  userTimeout: string;
  uploadToSwarm: boolean;
} & CliGlobalOptions): Listr<ListrContextBuildAndPublish> {
  const buildTimeout = parseTimeout(userTimeout);

  // Load manifest #### Todo: Deleted check functions. Verify manifest beforehand
  const manifest = readManifest(dir);

  // Make sure the release is of correct type
  if (manifest.image)
    throw new CliError(`
DAppNode packages expect all docker related data to be contained only
in the docker-compose.yml. Please translate the settings in 'manifest.image'
to your package's docker-compose.yml and then delete the 'manifest.image' prop.
`);
  if (manifest.avatar)
    throw new CliError(`
DAppNode packages expect the avatar to be located at the root folder as a file
and not declared in the manifest. Please add your package avatar to this directory
as ${releaseFiles.avatar.defaultName} and then remove the 'manifest.avatar' property.
`);

  // Bump upstreamVersion if provided
  if (process.env.UPSTREAM_VERSION) {
    manifest.upstreamVersion = process.env.UPSTREAM_VERSION;
  }

  // Define variables from manifest
  const { name, version } = manifest;
  if (/[A-Z]/.test(name))
    throw new CliError("Package name in the manifest must be lowercase");

  // Construct directories and names
  const imagePathUncompressed = path.join(buildDir, `${name}_${version}.tar`);
  const imagePathCompressed = `${imagePathUncompressed}.xz`;
  const imageFileName = path.parse(imagePathCompressed).base;
  const composeBuildPath = path.join(buildDir, `docker-compose.yml`);
  const avatarBuildPath = path.join(buildDir, `avatar.png`);
  const imageTag = `${name}:${version}`;
  // Root paths, this functions may throw
  const composeRootPath = getAssetPathRequired(releaseFiles.compose, dir);
  const avatarRootPath = getAssetPathRequired(releaseFiles.avatar, dir);
  if (avatarRootPath) verifyAvatar(avatarRootPath);

  return new Listr<ListrContextBuildAndPublish>(
    [
      {
        title: "Create release dir",
        task: async () => {
          // Create dir
          fs.mkdirSync(buildDir, { recursive: true }); // Ok on existing dir
          const buildFiles = fs.readdirSync(buildDir);

          // Clean all files except the image
          for (const file of buildFiles.filter(file => file !== imageFileName))
            fs.unlinkSync(path.join(buildDir, file));
        }
      },

      // Files should be copied for any type of release so they are available
      // in Github releases
      {
        title: "Copy files and validate",
        task: async () => {
          fs.copyFileSync(composeRootPath, composeBuildPath);
          fs.copyFileSync(avatarRootPath, avatarBuildPath);
          writeManifest(buildDir, manifest);
          validateManifest(manifest, { prerelease: true });

          const additionalFiles = [
            releaseFiles.setupWizard,
            releaseFiles.setupSchema,
            releaseFiles.setupTarget,
            releaseFiles.setupUiJson,
            releaseFiles.disclaimer,
            releaseFiles.gettingStarted
          ];
          for (const releaseFile of additionalFiles) {
            const filePath = getAssetPath(releaseFile, dir);
            if (filePath)
              fs.copyFileSync(
                filePath,
                path.join(buildDir, releaseFile.defaultName)
              );
          }
        }
      },

      {
        title: "Build docker image",
        task: async (_, task) => {
          // Before building make sure the imageTag in the docker-compose is correct
          updateCompose({ name, version, dir });
          await shell("docker-compose build", {
            timeout: buildTimeout,
            maxBuffer: 100 * 1e6,
            onData: data => (task.output = data)
          });
        }
      },

      /**
       * Save docker image
       * This step is extremely expensive computationally.
       * A local cache file will prevent unnecessary compressions if the image hasn't changed
       */
      {
        title: "Save and compress image",
        task: async (_, task) => {
          // Load image ID. Clean resulting string: Remove double quotes
          const imageId = await getImageId(imageTag);
          // Load the cache object
          const cacheTarHash = imageId && loadCache()[imageId];
          // Load the .tar.xz hash
          const tarHash = await getFileHash(imagePathCompressed);
          if (imageId && tarHash && tarHash === cacheTarHash) {
            task.skip(`Using cached verified tarball ${imagePathCompressed}`);
          } else {
            task.output = `Saving docker image to file...`;
            await shell(`docker save ${imageTag} > ${imagePathUncompressed}`);

            await compressFile(imagePathUncompressed, {
              timeout: buildTimeout,
              onData: msg => (task.output = msg)
            });

            task.output = `Storing saved image to cache...`;
            const newTarHash = await getFileHash(imagePathCompressed);
            if (imageId && newTarHash)
              writeCache({ key: imageId, value: newTarHash });
          }
        }
      },

      uploadToSwarm
        ? {
            title: "Upload release to Swarm",
            task: async (ctx, task) => {
              ctx.releaseHash = await swarmAddDirFromFs(
                buildDir,
                swarmProvider,
                percent => (task.output = percentToMessage(percent))
              );
            }
          }
        : {
            title: "Upload release to IPFS",
            task: async (ctx, task) => {
              // Starts with /ipfs/
              ctx.releaseHash = await ipfsAddFromFs(
                buildDir,
                ipfsProvider,
                percent => (task.output = percentToMessage(percent))
              );
            }
          },

      {
        title: "Save upload results",
        task: async ctx => {
          addReleaseRecord({
            dir,
            version,
            hash: ctx.releaseHash,
            to: uploadToSwarm ? swarmProvider : ipfsProvider
          });

          // "return" result for next tasks
          ctx.releaseMultiHash = ctx.releaseHash;
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}
