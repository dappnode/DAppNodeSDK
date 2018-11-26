// node modules
const yaml = require('js-yaml');
const FILESYSTEM = require('fs');
const DOCKERCOMPOSE = 'docker-compose.yml'

function generateCompose(dpnManifest, path = './') {

  const PACKAGE_NAME = dpnManifest.name.replace('/', '_').replace('@', '');

  let service = {};

  // Image name
  service.image = dpnManifest.name + ':' + dpnManifest.version;
  if (dpnManifest.restart) service.restart = dpnManifest.restart;

  service.build = "./build";

  // Volumes
  if (dpnManifest.image.volumes) {
    service.volumes = [
      ...(dpnManifest.image.volumes || []),
      ...(dpnManifest.image.external_vol || []),
    ];
  }

  // Ports
  if (dpnManifest.image.ports) {
    service.ports = dpnManifest.image.ports;
  }

  // Volumes
  let volumes = {};
  // Regular volumes
  if (dpnManifest.image.volumes) {
    dpnManifest.image.volumes.map((vol) => {
      // Make sure it's a named volume
      if (!vol.startsWith('/') && !vol.startsWith('~')) {
        const volName = vol.split(':')[0];
        volumes[volName] = {};
      }
    });
  }

  // External volumes
  if (dpnManifest.image.external_vol) {
    dpnManifest.image.external_vol.map((vol) => {
      const volName = vol.split(':')[0];
      volumes[volName] = {
        external: {
          'name': volName,
        },
      };
    });
  }

  let dockerCompose = {
    version: '3.4',
    services: {
      [PACKAGE_NAME]: service,
    },
  };
  if (Object.getOwnPropertyNames(volumes).length) dockerCompose.volumes = volumes;

  var ymlFile = yaml.dump(dockerCompose, { indent: 4, });


  FILESYSTEM.writeFileSync(path + DOCKERCOMPOSE, ymlFile, function(err) {
    if (err) {
      return console.log(err);
    }
  });

}

function updateCompose(dpnManifest) {
  FILESYSTEM.readdir('./', (err, files) => {
    for (var index in files) {
      if (files[index].endsWith(".yml")) {
        if (files[index].startsWith("docker-compose")) {
          try {
            const dockercompose = yaml.safeLoad(FILESYSTEM.readFileSync(files[index], 'utf8'));
            dockercompose.services[dpnManifest.name].image = dpnManifest.name + ':' + dpnManifest.version;
            var ymlFile = yaml.dump(dockercompose, { indent: 4, });
            FILESYSTEM.writeFileSync(files[index], ymlFile, function(err) {
              if (err) {
                return console.log(err);
              }
            });
          } catch (e) {
            console.log(e);
          }
        }
      }
    }
  });

}

module.exports = {
  generateCompose,
  updateCompose
};
