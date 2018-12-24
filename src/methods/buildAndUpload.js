const fs = require('fs');
const shell = require('../utils/shell');
const Ipfs = require('../utils/Ipfs');
const check = require('../utils/check');
const {getManifestPath, readManifest, writeManifest} = require('../utils/manifest');

async function buildAndUpload({dir, buildDir, ipfsProvider, silent}) {
  // Check variables
  check(buildDir, 'buildDir', 'string');
  // If the provider is infura don't show progress, their API does not support it
  const showProgress = !(ipfsProvider || '').includes('infura');

  // Init IPFS instance
  const ipfs = new Ipfs(ipfsProvider);

  // Load manifest
  const manifest = readManifest({dir});
  const manifestPath = getManifestPath({dir});

  // Define variables from manifest
  const version = manifest.version;
  const ensName = manifest.name;
  const shortName = manifest.name.split('.')[0];

  // Construct directories and names
  const imagePath = `${buildDir}${ensName}.tar.xz`;
  const imageTag = `${ensName}:${version}`;

  // Create the build directory. What if it's already created?
  await shell(`mkdir -p ${buildDir}`);

  // 0. Copy docker-compose.yml and *.env file to the buildDir
  // Copy the docker-compose. Expects only one docker-compose,
  // will fail if there are multiple docker-compose
  await shell(`cp docker-compose*.yml ${buildDir}docker-compose-${shortName}.yml`);
  // Copy all .env files, if any
  if (await shell(`ls *.env`).then(() => true).catch(() => false)) {
    await shell(`cp *.env ${buildDir}`);
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
  if (!silent) console.log(`Building Dockerfile to image ${imageTag}...`);
  await shell('docker-compose -f *.yml build');

  // 3. Save docker image
  if (!silent) console.log(`Saving docker image ${imageTag} to file ${imagePath}...`);
  await shell(`docker save ${imageTag} | xz -e9vT0 > ${imagePath}`);

  // 4. Upload docker image to IPFS
  if (!silent) console.log(`Uploading docker image file ${imagePath} to IPFS...`);
  const imageUpload = await ipfs.files.add([imagePath], {
    pin: true,
    ...(showProgress && !silent ? {progress: logProgress(imagePath)} : {}),
  }).then((res) => res[0]);
  // Edit manifest
  manifest.image.path = imageUpload.path;
  manifest.image.hash = `/ipfs/${imageUpload.hash}`;
  manifest.image.size = imageUpload.size;
  // Update manifest
  writeManifest({manifest, dir});

  // 5. Upload manifest to IPFS
  const manifestUpload = await ipfs.files.add([manifestPath], {pin: true}).then((res) => res[0]);
  // Write manifest IPFS upload results = {path, hash, size}
  fs.writeFileSync(`${buildDir}/manifest.json`, JSON.stringify(manifestUpload, null, 2));
  const manifestIpfsPath = `/ipfs/${manifestUpload.hash}`;
  if (!silent) console.log(`Manifest uploaded: ${manifestIpfsPath}`);
  return manifestIpfsPath;
}

function logProgress(pathToFile, log) {
  const totalSize = fs.statSync(pathToFile).size;
  return function progress(prog) {
    console.log('Uploading... ' + ((prog / totalSize) * 100).toFixed(2) + '%');
  };
}


module.exports = buildAndUpload;
