const fs = require('fs');
const chalk = require('chalk');
const timestring = require('timestring');
const shell = require('../utils/shell');
const Ipfs = require('../utils/Ipfs');
const check = require('../utils/check');
const getFileHash = require('../utils/getFileHash');
const getImageId = require('../utils/getImageId');
const cache = require('../utils/cache');
const {getManifestPath, readManifest, writeManifest} = require('../utils/manifest');

// Define build timeout (20 min)
let buildTimeout = 20 * 60 * 1000;

async function buildAndUpload({dir, buildDir, ipfsProvider, userTimeout, silent}) {
  // log function
  const log = silent ? () => {} : console.log;
  // Check variables
  check(buildDir, 'buildDir', 'string');
  // If the provider is infura don't show progress, their API does not support it
  const showProgress = !(ipfsProvider || '').includes('infura');
  // Parse userTimeout
  if (userTimeout) {
    // It's not a number assume it's a timestring formated string
    // Otherwise assume it's in seconds
    buildTimeout = parseInt(isNaN(userTimeout) ? timestring(userTimeout) : userTimeout) * 1000;
    log(`User set build timeout to ${buildTimeout} ms`);
  }

  // Init IPFS instance
  const ipfs = new Ipfs(ipfsProvider);

  // Load manifest
  const manifest = readManifest({dir});
  check(manifest, 'manifest', 'object');
  check(manifest.version, 'manifest version');
  check(manifest.name, 'manifest name');
  check(manifest.image, 'manifest image object', 'object');
  const manifestPath = getManifestPath({dir});

  // Define variables from manifest
  const version = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split('.')[0];

  // Construct directories and names
  const imagePath = `${buildDir}${ensName}_${version}.tar.xz`;
  const imageTag = `${ensName}:${version}`;

  // Create the build directory. What if it's already created?
  await shell(`mkdir -p ${buildDir}`, {silent: true});

  // 0. Copy docker-compose.yml and *.env file to the buildDir
  // Copy the docker-compose. Expects only one docker-compose,
  // will fail if there are multiple docker-compose
  await shell(`cp docker-compose*.yml ${buildDir}docker-compose-${shortName}.yml`, {silent});
  // Copy all .env files, if any
  if (
    await shell(`ls *.env`, {silent: true})
        .then(() => true)
        .catch(() => false)
  ) {
    await shell(`cp *.env ${buildDir}`, {silent: true});
  }

  // 1. Upload avatar to IPFS

  // log('uploading avatar to IPFS...');
  // const file = [{
  // path: manifest.avatar,
  // content: FILESYSTEM.createReadStream(manifest.avatar),
  // }];
  // const avatarHash = await ipfs.files.add(file).then((res) => res[0].hash);
  // manifest.avatar = `/ipfs/${avatarHash}`;
  // log(`Uploaded avatar, hash: /ipfs/${avatarHash}`);

  if (manifest.avatar && manifest.avatar.startsWith('/ipfs/')) {
    // pin avatar
  }

  // 2. Build Dockerfile
  log(`Building Dockerfile to image ${imageTag}...`);
  await shell('docker-compose -f *.yml build', {silent, timeout: buildTimeout});

  // 3. Save docker image
  // This step is extremely expensive computationally.
  // A local cache file will prevent unnecessary compressions if the image hasn't changed
  // Load image ID. Clean resulting string: Remove double quotes
  const imageId = await getImageId(imageTag, shell);
  // Load the cache object
  const cacheTarHash = cache.load()[imageId];
  // Load the .tar.xz hash
  const tarHash = await getFileHash(imagePath);
  if (imageId && tarHash && tarHash === cacheTarHash) {
    log(`Skipping image save and compression stage, tarball ${imagePath} has been verified`);
  } else {
    log(`Saving docker image ${imageTag} to file ${imagePath}...`);
    await shell(`docker save ${imageTag} | xz -e9vT0 > ${imagePath}`, {silent, timeout: buildTimeout});
    const newTarHash = await getFileHash(imagePath);
    if (imageId && newTarHash) cache.write({key: imageId, value: newTarHash});
  }

  // 4. Upload docker image to IPFS
  log(`Uploading docker image file ${imagePath} to IPFS...`);
  const imageUpload = await ipfs
      .addFromFs(imagePath, {
        pin: true,
        ...(showProgress && !silent ? {progress: logProgress(imagePath, log)} : {}),
      })
      .then((res) => res[0]);
  // Edit manifest
  manifest.image.path = imageUpload.path;
  manifest.image.hash = `/ipfs/${imageUpload.hash}`;
  manifest.image.size = imageUpload.size;
  // Update manifest
  writeManifest({manifest, dir});
  writeManifest({manifest, dir: buildDir});

  // 5. Upload manifest to IPFS
  const manifestUpload = await ipfs.addFromFs(manifestPath, {pin: true}).then((res) => res[0]);
  // Write manifest IPFS upload results = {path, hash, size}
  fs.writeFileSync(`${buildDir}/upload.json`, JSON.stringify(manifestUpload, null, 2));
  const manifestIpfsPath = `/ipfs/${manifestUpload.hash}`;
  if (!silent) log(`${chalk.green('Manifest uploaded:')} ${manifestIpfsPath}`);
  return manifestIpfsPath;
}

function logProgress(pathToFile, log) {
  const totalSize = fs.statSync(pathToFile).size;
  return function progress(prog) {
    log('Uploading... ' + ((prog / totalSize) * 100).toFixed(2) + '%');
  };
}

module.exports = buildAndUpload;
