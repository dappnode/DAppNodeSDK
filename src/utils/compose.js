// node modules
const yaml = require('js-yaml');
const fs = require('fs');
const check = require('../utils/check');

const DOCKERCOMPOSE = 'docker-compose.yml';

/**
 * Get compose path. Without arguments defaults to './docker-compose.yml'
 *
 * @param {Object} kwargs: {
 *   dir: './folder', [optional] directory to load the manifest from
 *   composeFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 * @return {String} path = './dappnode_package.json'
 */
function getComposePath({dir = './', composeFileName = DOCKERCOMPOSE}) {
  return `${dir}${composeFileName}`;
}

/**
 * Read the docker-compose.
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param {Object} kwargs: {
 *   dir: './folder', [optional] directory to load the manifest from
 *   composeFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 */
function generateAndWriteCompose({manifest, dir, composeFileName}) {
  const composeYaml = generateCompose({manifest});
  writeCompose({composeYaml, dir, composeFileName});
}

/**
 * Generates and writes the docker-compose.
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param {Object} kwargs: {
 *   manifest: <manifest object>
 *   dir: './folder', [optional] directory to load the manifest from
 *   composeFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 * @return {Object} compose object
 */
function readCompose({dir, composeFileName}) {
  const path = getComposePath({dir, composeFileName});

  // Recommended way of checking a file existance https://nodejs.org/api/fs.html#fs_fs_exists_path_callback
  let data;
  try {
    data = fs.readFileSync(path, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw Error(`No docker-compose found at ${path}. Make sure you are in a directory with an initialized DNP.`);
    } else {
      throw e;
    }
  }

  // Parse compose in try catch block to show a comprehensive error message
  let compose;
  try {
    compose = yaml.safeLoad(data);
  } catch (e) {
    throw Error(`Error parsing docker-compose: ${e.message}`);
  }

  // Return compose object
  return compose;
}

/**
 * Writes the docker-compose.
 * Without arguments defaults to write the manifest at './docker-compose.yml'
 *
 * @param {Object} kwargs: {
 *   composeYaml: <yaml string>
 *   dir: './folder', [optional] directory to load the manifest from
 *   composeFileName: 'manifest-admin.json', [optional] name of the manifest file
 * }
 */
function writeCompose({composeYaml, dir, composeFileName}) {
  const path = getComposePath({dir, composeFileName});
  fs.writeFileSync(path, composeYaml);
}

function generateCompose({manifest}) {
  check(manifest, 'manifest', 'object');
  check(manifest.name, 'manifest name', 'string');
  check(manifest.version, 'manifest version', 'string');
  check(manifest.image, 'manifest image', 'object');

  const ensName = manifest.name.replace('/', '_').replace('@', '');

  const service = {};

  // Image name
  service.image = manifest.name + ':' + manifest.version;
  if (manifest.restart) service.restart = manifest.restart;

  service.build = './build';

  // Volumes
  if (manifest.image.volumes) {
    service.volumes = [
      ...(manifest.image.volumes || []),
      ...(manifest.image.external_vol || []),
    ];
  }

  // Ports
  if (manifest.image.ports) {
    service.ports = manifest.image.ports;
  }

  // Volumes
  const volumes = {};
  // Regular volumes
  if (manifest.image.volumes) {
    manifest.image.volumes.map((vol) => {
      // Make sure it's a named volume
      if (!vol.startsWith('/') && !vol.startsWith('~')) {
        const volName = vol.split(':')[0];
        volumes[volName] = {};
      }
    });
  }

  // External volumes
  if (manifest.image.external_vol) {
    manifest.image.external_vol.map((vol) => {
      const volName = vol.split(':')[0];
      volumes[volName] = {
        external: {
          'name': volName,
        },
      };
    });
  }

  const dockerCompose = {
    version: '3.4',
    services: {
      [ensName]: service,
    },
  };
  if (Object.getOwnPropertyNames(volumes).length) dockerCompose.volumes = volumes;

  return yaml.dump(dockerCompose, {indent: 4});
}

function updateCompose({manifest, dir, composeFileName}) {
  const dockerCompose = readCompose({dir, composeFileName});
  // Only update the imageName field
  //   services:
  //     wamp.dnp.dappnode.eth:
  //       image: 'wamp.dnp.dappnode.eth:0.1.1'
  dockerCompose.services[manifest.name].image = manifest.name + ':' + manifest.version;
  const composeYaml = yaml.dump(dockerCompose, {indent: 4});
  writeCompose({composeYaml, dir, composeFileName});
}

module.exports = {
  generateAndWriteCompose,
  generateCompose,
  updateCompose,
  readCompose,
  writeCompose,
};
