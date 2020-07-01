import fs from "fs";
import path from "path";
import Listr from "listr";
// @ts-ignore
import timestring from "timestring";
import { getFileHash } from "../utils/getFileHash";
import { getImageId } from "../utils/getImageId";
import { loadCache, writeCache } from "../utils/cache";
import {
  getManifestPath,
  readManifest,
  writeManifest
} from "../utils/manifest";
import { validateManifest } from "../utils/validateManifest";
import { verifyAvatar } from "../utils/verifyAvatar";
import { getAssetPath, getAssetPathRequired } from "../utils/getAssetPath";
import { addReleaseRecord } from "../utils/releaseRecord";
import { releaseFiles, CliError } from "../params";
import { shell } from "../utils/shell";

// Commands
import { compressFile } from "../utils/commands/compressFile";
import { ipfsAddFromFs } from "../utils/ipfs/ipfsAddFromFs";
import { swarmAddDirFromFs } from "../utils/commands/swarmAddDirFromFs";
import { updateCompose } from "../utils/compose";
import { CliGlobalOptions } from "../types";

interface ListContextBuildAndUpload {
  releaseHash: string;
  releaseMultiHash: string;
}

// Define build timeout (20 min)
const defaultBuildTimeout = 20 * 60 * 1000;

// Pretty percent uploaded reporting
const percentToMessage = (percent: number) =>
  `Uploading... ${(percent * 100).toFixed(2)}%`;

export function buildAndUpload({
  buildDir,
  ipfsProvider,
  swarmProvider,
  userTimeout,
  isDirectoryRelease,
  uploadToSwarm,
  dir,
  verbose,
  silent
}: {
  buildDir: string;
  ipfsProvider: string;
  swarmProvider: string;
  userTimeout: string;
  isDirectoryRelease: boolean;
  uploadToSwarm: boolean;
} & CliGlobalOptions): Listr<ListContextBuildAndUpload> {
  // Enforce here also, just in case
  if (uploadToSwarm) isDirectoryRelease = true;

  /**
   * Parse userTimeout
   * It's not a number assume it's a timestring formated string
   * Otherwise assume it's in seconds
   */
  const buildTimeout = userTimeout
    ? parseInt(
        isNaN(parseInt(userTimeout)) ? timestring(userTimeout) : userTimeout
      ) * 1000
    : defaultBuildTimeout;

  // Load manifest #### Deleted check functions. Verify manifest beforehand
  const manifest = readManifest(dir);
  const manifestPath = getManifestPath(dir);

  // Make sure the release is of correct type
  if (isDirectoryRelease && manifest.image)
    throw new CliError(`You are building a directory type release but there are image settings in the manifest.
Please, move all image settings from the manifest to the docker-compose.yml 
and remove the manifest.image property
`);
  if (isDirectoryRelease && manifest.avatar)
    throw new CliError(`You are building a directory type release but the avatar in declared in the manifest.
Just delete the 'manifest.avatar' property, and it will be added in the release automatically
`);

  // If there is no manifest.image prop, assume directory type
  if (!manifest.image && !isDirectoryRelease) {
    console.warn("Assuming directory type release");
    isDirectoryRelease = true;
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

  return new Listr<ListContextBuildAndUpload>(
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

      isDirectoryRelease
        ? {
            title: "Copy files and validate (directory)",
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
          }
        : {
            title: "Copy files and validate",
            task: async () => {
              fs.copyFileSync(composeRootPath, composeBuildPath);
              fs.copyFileSync(avatarRootPath, avatarBuildPath);
              validateManifest(manifest, { prerelease: true });
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
            title: "Upload directory release to Swarm",
            task: async (ctx, task) => {
              ctx.releaseHash = await swarmAddDirFromFs(
                buildDir,
                swarmProvider,
                percent => (task.output = percentToMessage(percent))
              );
            }
          }
        : isDirectoryRelease
        ? {
            title: "Upload directory release to IPFS",
            task: async (ctx, task) => {
              // Starts with /ipfs/
              ctx.releaseHash = await ipfsAddFromFs(
                buildDir,
                ipfsProvider,
                percent => (task.output = percentToMessage(percent))
              );
            }
          }
        : {
            title: "Upload manifest release to IPFS",
            task: async (ctx, task) => {
              // Mutate manifest, already starts with /ipfs/
              manifest.avatar = await ipfsAddFromFs(
                avatarRootPath,
                ipfsProvider
              );

              // Starts with /ipfs/
              const imageUploadHash = await ipfsAddFromFs(
                imagePathCompressed,
                ipfsProvider,
                percent => (task.output = percentToMessage(percent))
              );
              // Mutate manifest
              manifest.image = {
                ...manifest.image,
                path: path.parse(imagePathCompressed).base,
                hash: imageUploadHash, // Already starts with /ipfs/
                size: fs.statSync(imagePathCompressed).size
              };

              // validateManifest calls `process.exit(1)` in case of error
              validateManifest(manifest);
              // Update manifest
              writeManifest(dir, manifest);
              writeManifest(buildDir, manifest);
              // Starts with /ipfs/
              ctx.releaseHash = await ipfsAddFromFs(
                manifestPath,
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
            type: isDirectoryRelease ? "directory" : "manifest",
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
