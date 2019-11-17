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
const validateManifest = require("../utils/validateManifest");
const verifyAvatar = require("../utils/verifyAvatar");
const getAssetPath = require("../utils/getAssetPath");
const { addReleaseRecord } = require("../utils/releaseRecord");
const { releaseFiles, CliError } = require("../params");

// Commands
const compressFile = require("../utils/commands/compressFile");
const execaProgress = require("../utils/commands/execaProgress");
const ipfsAddFromFs = require("../utils/commands/ipfsAddFromFs");
const ipfsAddDirFromFs = require("../utils/commands/ipfsAddDirFromFs");
const swarmAddDirFromFs = require("../utils/commands/swarmAddDirFromFs");
const { updateCompose } = require("../utils/compose");

// Define build timeout (20 min)
const defaultBuildTimeout = 20 * 60 * 1000;

function buildAndUpload({
  dir,
  buildDir,
  ipfsProvider,
  swarmProvider,
  userTimeout,
  isDirectoryRelease,
  uploadToSwarm,
  verbose,
  silent
}) {
  // Enforce here also, just in case
  if (uploadToSwarm) isDirectoryRelease = true;

  /**
   * Parse userTimeout
   * It's not a number assume it's a timestring formated string
   * Otherwise assume it's in seconds
   */
  const buildTimeout = userTimeout
    ? parseInt(isNaN(userTimeout) ? timestring(userTimeout) : userTimeout) *
      1000
    : defaultBuildTimeout;

  // Load manifest #### Deleted check functions. Verify manifest beforehand
  const manifest = readManifest({ dir });
  const manifestPath = getManifestPath({ dir });

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

  // Construct directories and names
  const imagePathUncompressed = path.join(buildDir, `${name}_${version}.tar`);
  const imagePathCompressed = `${imagePathUncompressed}.xz`;
  const imageFileName = path.parse(imagePathCompressed).base;
  const composeBuildPath = path.join(buildDir, `docker-compose.yml`);
  const avatarBuildPath = path.join(buildDir, `avatar.png`);
  const imageTag = `${name}:${version}`;
  // Root paths, this functions may throw
  const composeRootPath = getAssetPath(releaseFiles.compose, dir);
  const avatarRootPath = getAssetPath(releaseFiles.avatar, dir);
  verifyAvatar(avatarRootPath);

  const createReleaseDirTask = {
    title: "Create release dir",
    task: async () => {
      // Create dir
      fs.mkdirSync(buildDir, { recursive: true }); // Ok on existing dir
      const buildFiles = fs.readdirSync(buildDir);

      // Clean all files except the image
      for (const file of buildFiles.filter(file => file !== imageFileName))
        fs.unlinkSync(path.join(buildDir, file));
    }
  };

  // Files should be copied for any type of release so they are available
  // in Github releases

  const copyFilesDirectoryTypeTask = {
    title: "Copy files and validate (directory)",
    task: async () => {
      fs.copyFileSync(composeRootPath, composeBuildPath);
      fs.copyFileSync(avatarRootPath, avatarBuildPath);
      writeManifest({ manifest, dir: buildDir });
      validateManifest(manifest, { prerelease: true, noImage: true });

      const additionalFiles = [
        releaseFiles.setupSchema,
        releaseFiles.setupUiJson,
        releaseFiles.disclaimer
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
  };

  const copyFilesManifestTypeTask = {
    title: "Copy files and validate",
    task: async () => {
      fs.copyFileSync(composeRootPath, composeBuildPath);
      fs.copyFileSync(avatarRootPath, avatarBuildPath);
      validateManifest(manifest, { prerelease: true });
    }
  };

  const buildDockerImageTask = {
    title: "Build docker image",
    task: async (_, task) => {
      // Before building make sure the imageTag in the docker-compose is correct
      updateCompose({ name, version });

      const logger = msg => {
        task.output = msg;
      };
      await execaProgress("docker-compose build", { logger });
    }
  };

  /**
   * Save docker image
   * This step is extremely expensive computationally.
   * A local cache file will prevent unnecessary compressions if the image hasn't changed
   */
  const saveAndComposeImageTask = {
    title: "Save and compress image",
    task: async (_, task) => {
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
        await execa.shell(`docker save ${imageTag} > ${imagePathUncompressed}`);

        await compressFile(imagePathUncompressed, {
          timeout: buildTimeout,
          logger: msg => {
            task.output = msg;
          }
        });

        task.output = `Storing saved image to cache...`;
        const newTarHash = await getFileHash(imagePathCompressed);
        if (imageId && newTarHash)
          cache.write({ key: imageId, value: newTarHash });
      }
    }
  };

  const uploadDirectoryReleaseToSwarmTasks = [
    {
      title: "Upload directory release to Swarm",
      task: async (ctx, task) => {
        ctx.releaseHash = await swarmAddDirFromFs(buildDir, swarmProvider, {
          logger: msg => {
            task.output = msg;
          }
        });
      }
    }
  ];

  const uploadDirectoryReleaseToIpfsTasks = [
    {
      title: "Upload directory release to IPFS",
      task: async (ctx, task) => {
        // Starts with /ipfs/
        ctx.releaseHash = await ipfsAddDirFromFs(buildDir, ipfsProvider, {
          logger: msg => {
            task.output = msg;
          }
        });
      }
    }
  ];

  const uploadManifestReleaseToIpfsTasks = [
    {
      title: "Upload avatar to IPFS",
      task: async () => {
        // Mutate manifest, already starts with /ipfs/
        manifest.avatar = await ipfsAddFromFs(avatarRootPath, ipfsProvider);
      }
    },
    {
      title: "Upload image to IPFS",
      task: async (_, task) => {
        // Starts with /ipfs/
        const imageUploadHash = await ipfsAddFromFs(
          imagePathCompressed,
          ipfsProvider,
          {
            logger: msg => {
              task.output = msg;
            }
          }
        );
        // Mutate manifest
        manifest.image = {
          ...manifest.image,
          path: path.parse(imagePathCompressed).base,
          hash: imageUploadHash, // Already starts with /ipfs/
          size: fs.statSync(imagePathCompressed).size
        };
      }
    },
    {
      title: "Upload manifest to IPFS",
      task: async (ctx, task) => {
        // validateManifest calls `process.exit(1)` in case of error
        validateManifest(manifest);
        // Update manifest
        writeManifest({ manifest, dir });
        writeManifest({ manifest, dir: buildDir });
        // Starts with /ipfs/
        ctx.releaseHash = await ipfsAddFromFs(manifestPath, ipfsProvider, {
          logger: msg => {
            task.output = msg;
          }
        });
      }
    }
  ];

  const writeResultsTask = {
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
  };

  return new Listr(
    [
      createReleaseDirTask,
      isDirectoryRelease
        ? copyFilesDirectoryTypeTask
        : copyFilesManifestTypeTask,
      buildDockerImageTask,
      saveAndComposeImageTask,
      ...(uploadToSwarm
        ? uploadDirectoryReleaseToSwarmTasks
        : isDirectoryRelease
        ? uploadDirectoryReleaseToIpfsTasks
        : uploadManifestReleaseToIpfsTasks),
      writeResultsTask
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

module.exports = buildAndUpload;
