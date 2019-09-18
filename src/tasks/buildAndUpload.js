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
const getPathRootAvatarAndVerify = require("../utils/getPathRootAvatarAndVerify");
const getPathRootCompose = require("../utils/getPathRootCompose");
const { addReleaseRecord } = require("../utils/releaseRecord");

// Commands
const compressFile = require("../utils/commands/compressFile");
const execaProgress = require("../utils/commands/execaProgress");
const ipfsAddFromFs = require("../utils/commands/ipfsAddFromFs");
const ipfsAddDirFromFs = require("../utils/commands/ipfsAddDirFromFs");

// Define build timeout (20 min)
const defaultBuildTimeout = 20 * 60 * 1000;

function buildAndUpload({
  dir,
  buildDir,
  ipfsProvider,
  userTimeout,
  isDirectoryRelease,
  verbose,
  silent
}) {
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

  // Define variables from manifest
  const { name, version } = manifest;

  // Construct directories and names
  const imagePathUncompressed = path.join(buildDir, `${name}_${version}.tar`);
  const imagePathCompressed = `${imagePathUncompressed}.xz`;
  const imageFileName = path.parse(imagePathCompressed).base;
  const manifestBuildPath = path.join(buildDir, `dappnode_package.json`);
  const composeBuildPath = path.join(buildDir, `docker-compose.yml`);
  const avatarBuildPath = path.join(buildDir, `avatar.png`);
  const imageTag = `${name}:${version}`;
  // Root paths, this functions may throw
  const avatarRootPath = getPathRootAvatarAndVerify(dir);
  const composeRootPath = getPathRootCompose(dir);

  const copyFilesTask = {
    title: "Copy files and validate",
    task: async () => {
      // Create dir
      fs.mkdirSync(buildDir, { recursive: true }); // Ok on existing dir
      const buildFiles = fs.readdirSync(buildDir);

      // Clean all files except the image
      for (const file of buildFiles.filter(file => file !== imageFileName))
        fs.unlinkSync(path.join(buildDir, file));

      if (isDirectoryRelease) {
        fs.copyFileSync(manifestPath, manifestBuildPath);
        fs.copyFileSync(composeRootPath, composeBuildPath);
        fs.copyFileSync(avatarRootPath, avatarBuildPath);
      }

      // Validate. ValidateManifest will call `process.exit(1)` if manifest is invalid
      validateManifest(manifest, {
        prerelease: true,
        noImage: isDirectoryRelease
      });
    }
  };

  const buildDockerImageTask = {
    title: "Build docker image",
    task: async (_, task) => {
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

  const uploadDirectoryTypeReleaseTasks = [
    {
      title: "Upload directory release to IPFS",
      task: async (ctx, task) => {
        ctx.releaseUpload = await ipfsAddDirFromFs(buildDir, ipfsProvider, {
          logger: msg => {
            task.output = msg;
          }
        });
      }
    }
  ];

  const uploadManifestTypeReleaseTasks = [
    {
      title: "Upload avatar to IPFS",
      task: async () => {
        const avatarUpload = await ipfsAddFromFs(avatarRootPath, ipfsProvider);
        // Mutate manifest
        manifest.avatar = `/ipfs/${avatarUpload.hash}`;
      }
    },
    {
      title: "Upload image to IPFS",
      task: async (_, task) => {
        const imageUpload = await ipfsAddFromFs(
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
          path: imageUpload.path,
          hash: `/ipfs/${imageUpload.hash}`,
          size: imageUpload.size
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

        ctx.releaseUpload = await ipfsAddFromFs(manifestPath, ipfsProvider, {
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
        hash: `/ipfs/${ctx.releaseUpload.hash}`,
        type: isDirectoryRelease ? "directory" : "manifest",
        ipfsProvider
      });

      // "return" result for next tasks
      ctx.releaseIpfsPath = `/ipfs/${ctx.releaseUpload.hash}`;
    }
  };

  return new Listr(
    [
      copyFilesTask,
      buildDockerImageTask,
      saveAndComposeImageTask,
      ...(isDirectoryRelease
        ? uploadDirectoryTypeReleaseTasks
        : uploadManifestTypeReleaseTasks),
      writeResultsTask
    ],
    { renderer: verbose ? "verbose" : silent ? "silent" : "default" }
  );
}

module.exports = buildAndUpload;
