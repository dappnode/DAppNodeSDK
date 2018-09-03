const FILESYSTEM = require('fs');
const MANIFEST_NAME = 'dappnode_package.json'


function generateManifest(manifest, path = './') {
    FILESYSTEM.writeFileSync(path + MANIFEST_NAME, JSON.stringify(manifest, null, 2), function(err) {
        if (err) {
            return console.log(err);
        }
    });
}

async function manifestFromCompose(dockercompose) {
    var name = Object.keys(dockercompose.services)[0];
    var version = dockercompose.services[name].image.split(':')[1];

    var manifestDefinition = {
        "name": name,
        "version": version,
        "description": "",
        "avatar": "",
        "type": "",
        "image": {
            "path": "",
            "hash": "",
            "size": ""
        },
        "author": "",
        "license": ""
    };

    if (dockercompose.services[name].ports) manifestDefinition.image.ports = dockercompose.services[name].ports;
    if (dockercompose.services[name].volumes) manifestDefinition.image.volumes = dockercompose.services[name].volumes;
    if (dockercompose.services[name].restart) manifestDefinition.image.restart = dockercompose.services[name].restart;
    console.log(manifestDefinition)
    return manifestDefinition;
}

module.exports = {
    generateManifest,
    manifestFromCompose
};
