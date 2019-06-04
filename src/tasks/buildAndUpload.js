const fs = require("fs");
const path = require("path");
const Listr = require("listr");
const execa = require("execa");
const timestring = require("timestring");
const getFileHash = require("../utils/getFileHash");
const getImageId = require("../utils/getImageId");
const cache = require("../utils/cache");
const {
  getManifestPath,
  readManifest,
  writeManifest
} = require("../utils/manifest");
// Commands
const compressFile = require("../utils/commands/compressFile");
const execaProgress = require("../utils/commands/execaProgress");
const ipfsAddFromFs = require("../utils/commands/ipfsAddFromFs");

// Define build timeout (20 min)
let buildTimeout = 20 * 60 * 1000;

function buildAndUpload({
  dir,
  buildDir,
  ipfsProvider,
  userTimeout,
  verbose,
  silent
}) {
  // Parse userTimeout
  if (userTimeout) {
    // It's not a number assume it's a timestring formated string
    // Otherwise assume it's in seconds
    buildTimeout =
      parseInt(isNaN(userTimeout) ? timestring(userTimeout) : userTimeout) *
      1000;
  }

  // Load manifest #### Deleted check functions. Verify manifest beforehand
  const manifest = readManifest({ dir });
  const manifestPath = getManifestPath({ dir });

  // Define variables from manifest
  const version = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split(".")[0];

  // Construct directories and names
  const imagePathUncompressed = path.join(
    buildDir,
    `${ensName}_${version}.tar`
  );
  const imagePathCompressed = path.join(
    buildDir,
    `${ensName}_${version}.tar.xz`
  );
  const composePath = path.join(buildDir, `docker-compose-${shortName}.yml`);
  const uploadPath = path.join(buildDir, `upload.json`);
  const imageTag = `${ensName}:${version}`;

  return new Listr(
    [
      /**
       * 0. Prepare files and folders
       */
      {
        title: "Copy files to new build folder",
        task: async () => {
          // Create the build directory. What if it's already created?
          await execa.shell(`mkdir -p ${buildDir}`);
          // Copy the docker-compose. Expects only one docker-compose,
          // will fail if there are multiple docker-compose
          await execa.shell(`cp docker-compose*.yml ${composePath}`);
          // Copy all .env files, if any
          if (
            await execa
              .shell(`ls *.env`)
              .then(() => true)
              .catch(() => false)
          ) {
            await execa.shell(`cp *.env ${buildDir}`);
          }
        }
      },
      /**
       * 1. Upload avatar to IPFS
       */
      {
        title: "Upload avatar to IPFS",
        task: async () => {
          // log('uploading avatar to IPFS...');
          // const file = [{
          // path: manifest.avatar,
          // content: FILESYSTEM.createReadStream(manifest.avatar),
          // }];
          // const avatarHash = await ipfs.files.add(file).then((res) => res[0].hash);
          // manifest.avatar = `/ipfs/${avatarHash}`;
          // log(`Uploaded avatar, hash: /ipfs/${avatarHash}`);

          if (manifest.avatar && manifest.avatar.startsWith("/ipfs/")) {
            // pin avatar
          }
        }
      },
      /**
       * 2. Build Dockerfile
       */
      {
        title: "Build docker image",
        task: async (_, task) => {
          const logger = msg => {
            task.output = msg;
          };
          await execaProgress("docker-compose build", { logger });
        }
      },
      /**
       * 3. Save docker image
       * This step is extremely expensive computationally.
       * A local cache file will prevent unnecessary compressions if the image hasn't changed
       */
      {
        title: "Save and compress image",
        task: async (ctx, task) => {
          // Load image ID. Clean resulting string: Remove double quotes
          const imageId = await getImageId(imageTag);
          // Load the cache object
          const cacheTarHash = cache.load()[imageId];
          // Load the .tar.xz hash
          const tarHash = await getFileHash(imagePathCompressed);
          if (imageId && tarHash && tarHash === cacheTarHash) {
            task.skip(`Using cached verified tarball ${imagePathCompressed}`);
          } else {
            task.output = `Saving docker image to file...`;
            await execa.shell(
              `docker save ${imageTag} > ${imagePathUncompressed}`
            );

            const logger = msg => {
              task.output = msg;
            };
            await compressFile(imagePathUncompressed, {
              timeout: buildTimeout,
              logger
            });

            task.output = `Storing saved image to cache...`;
            const newTarHash = await getFileHash(imagePathCompressed);
            if (imageId && newTarHash)
              cache.write({ key: imageId, value: newTarHash });
          }
        }
      },
      /**
       * 4. Upload docker image to IPFS
       */
      {
        title: "Upload image to IPFS",
        task: async (ctx, task) => {
          const imageUpload = await ipfsAddFromFs(
            imagePathCompressed,
            ipfsProvider,
            {
              logger: msg => {
                task.output = msg;
              }
            }
          );
          ctx.imageUpload = imageUpload;
        }
      },
      /**
       * 5. Save and upload manifest
       */
      {
        title: "Save and upload manifest to IPFS",
        task: async (ctx, task) => {
          const { imageUpload } = ctx;
          // Edit manifest
          manifest.image.path = imageUpload.path;
          manifest.image.hash = `/ipfs/${imageUpload.hash}`;
          manifest.image.size = imageUpload.size;
          // Update manifest
          writeManifest({ manifest, dir });
          writeManifest({ manifest, dir: buildDir });

          const manifestUpload = await ipfsAddFromFs(
            manifestPath,
            ipfsProvider,
            {
              logger: msg => {
                task.output = msg;
              }
            }
          );
          // Write manifest IPFS upload results = {path, hash, size}
          fs.writeFileSync(uploadPath, JSON.stringify(manifestUpload, null, 2));
          ctx.manifestIpfsPath = `/ipfs/${manifestUpload.hash}`;
        }
      }
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

module.exports = buildAndUpload;
