const FILESYSTEM = require('fs');
const SEMVER = require('semver');
const INQUIRER = require('inquirer');
const generateManifest = require('./generateManifest')
const generateCompose = require('./generateCompose')
const SHELL = require('shelljs')

function DappNodePackageRepo() {
    return new Promise(function(resolve, reject) {
        INQUIRER.prompt([
            {
                type: 'input',
                name: 'name',
                default: 'package_name',
                message: 'DAppNodePackage name',
            },
            {
                type: 'input',
                name: 'version',
                default: '0.0.1',
                message: 'Version',
                validate: (val) => !SEMVER.valid(val) ? 'the version needs to be a semver valid' : true
            },
            {
                type: 'input',
                name: 'description',
                message: 'Description',
                default: 'Description',
            },
            {
                type: 'input',
                message: 'Avatar',
                name: 'avatar',
                validate: (val) => (!FILESYSTEM.existsSync(val) && val != '') ? 'the avatar must be an png or jpg in the local path or leave it empty' : true
            },
            {
                type: 'list',
                name: 'type',
                message: 'Type',
                default: 'service',
                choices: ['service', 'library', 'dncore']
            },
            {
                type: 'input',
                message: 'Ports to expose externally (eg: 31313:30303;31313:30303/udp )',
                name: 'ports',
            },
            {
                type: 'input',
                message: 'Volumes to be persistent (eg: ipfsdnpdappnodeeth_export:/export;/home/ipfs_data:/data/ipfs)',
                name: 'volumes',
                default: 'ipfsdnpdappnodeeth_export:/export;/home/ipfs_data:/data/ipfs'
            },
            {
                type: 'input',
                message: 'Author',
                name: 'author',
            },
            {
                type: 'input',
                message: 'Keywords (tags) separated by semicolons (eg: "DAppNodeCore;IPFS" )',
                name: 'keywords',
            }
        ]).then(async function(answers) {

            var manifestDefinition = {
                "name": answers.name + '.public.dappnode.eth',
                "version": answers.version,
                "description": answers.description,
                "avatar": answers.avatar,
                "type": answers.type,
                "image": {
                    "path": "",
                    "hash": "",
                    "size": "",
                    "restart": "always"
                },
                "author": answers.author,
                "license": ""
            };

            if (answers.volumes) manifestDefinition.image.volumes = answers.volumes.split(";");
            if (answers.ports) manifestDefinition.image.ports = answers.ports.split(";");
            if (answers.keywords) manifestDefinition.image.keywords = answers.keywords.split(";");

            var path = './DAppNodePackage-' + answers.name + '/';
            SHELL.mkdir('-p', path);

            await generateManifest.generateManifest(manifestDefinition, path);
            await generateCompose.generateCompose(manifestDefinition, path);

            SHELL.mkdir('-p', path + "build");

            FILESYSTEM.writeFileSync(path + "build/Dockerfile", "FROM alpine", function(err) {
                if (err) {
                    return console.log(err);
                }
            });

            resolve();
        });
    })
}

module.exports = {
    DappNodePackageRepo
};
