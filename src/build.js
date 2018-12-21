const FILESYSTEM = require('fs')
const SHELL = require('shelljs')
const ipfsAPI = require('ipfs-api')

const IPFS_PROVIDER = process.env.IPFS_PROVIDER || 'my.ipfs.dnp.dappnode.eth';
const IPFS_PROTO = process.env.IPFS_PROTO || 'http';

const ipfs = new ipfsAPI({ host: IPFS_PROVIDER, port: 5001, protocol: IPFS_PROTO });

const apm = require('./apm')
const chalk = require('chalk')

var dappnode_package;
var developer;
var generateTX;

async function newBuild(_generateTX = false, _developer = '0x0000000000000000000000000000000000000000') {
    developer = _developer;
    generateTX = _generateTX
    dappnode_package = JSON.parse(FILESYSTEM.readFileSync('dappnode_package.json', 'utf8'));
    name = dappnode_package.name;
    tag = dappnode_package.name;
    if (dappnode_package.name.startsWith("@")) {
        tag = dappnode_package.name.slice(1);
    }
    version = dappnode_package.version;
    image_name = tag.replace("/", "_") + "_" + version;
    build_dir = './build_' + version + "/";
    SHELL.mkdir('-p', build_dir);

    copyCompose(build_dir, dappnode_package.name);
    copyEnv(build_dir);

    await uploadAvatarIPFS();
    await buildDockerfile();
    await saveDockerImage();
    await uploadDockerImageIPFS();
    await uploadManifest();
}

function uploadAvatarIPFS() {
    console.log("uploadAvatarIPFS...")
    if (!dappnode_package.avatar.startsWith('/ipfs/') && dappnode_package.avatar != '') {
        return new Promise(function(resolve, reject) {
            var file = [{
                path: dappnode_package.avatar,
                content: FILESYSTEM.createReadStream(dappnode_package.avatar)
            }];

            ipfs.files.add(file)
                .then((response) => {
                    dappnode_package.avatar = '/ipfs/' + response[0].hash;
                    console.log(dappnode_package.avatar);
                    ipfs.pin.add(response[0].hash);
                    resolve("Avatar uploaded!");
                }).catch((err) => {
                    console.error(err)
                })
        });
    } else {
        console.log(dappnode_package.avatar);
    }
}

function buildDockerfile() {
    return new Promise(function(resolve, reject) {
        console.log("buildDockerfile...");
        SHELL.exec('docker-compose -f *.yml build', { async: false }, function(code, stdout, stderr) {
            if (code !== 0) {
                console.log("stderr:" + stderr);
            } else {
                console.log("Image " + tag + ":" + version + " generated!");
                resolve("Image " + tag + ":" + version + " generated!");
            }
        });
    });
}

function saveDockerImage() {
    return new Promise(function(resolve, reject) {
        console.log("saveDockerImage...");
        SHELL.exec('docker save ' + tag + ":" + version + " | xz -e9vT0 > " + build_dir + image_name + ".tar.xz", function(code, stdout, stderr) {
            if (code !== 0) {
                console.log("stderr:" + stderr);
            } else {
                console.log("Image save at " + build_dir + image_name + ".tar.xz");
                resolve("Image save at " + build_dir + image_name + ".tar.xz");
            }
        });
    });
}

function uploadDockerImageIPFS() {
    return new Promise(function(resolve, reject) {
        console.log("uploadDockerImageIPFS...");
        var file = [{
            path: image_name + ".tar.xz",
            content: FILESYSTEM.createReadStream(build_dir + image_name + ".tar.xz")
        }];

        if (IPFS_PROVIDER != "ipfs.infura.io") {
            ipfs.files.add(file, { progress: (prog) => console.log('Uploading... ' + ((prog / FILESYSTEM.statSync(build_dir + image_name + ".tar.xz").size) * 100).toFixed(2) + "%") })
                .then((response) => { ipfsUploaded(response); resolve("Image uploaded!"); })
                .catch((err) => {
                    console.log("ipfs.files.add err");
                    console.error(err)
                    reject("Error uploading file")
                })
        } else {
            ipfs.files.add(file)
                .then((response) => { ipfsUploaded(response); resolve("Image uploaded!"); })
                .catch((err) => {
                    console.error(err)
                    reject("Error uploading file")
                })
        }
    })
}

function ipfsUploaded(response) {
    dappnode_package.image.path = response[0].path;
    dappnode_package.image.hash = '/ipfs/' + response[0].hash;
    dappnode_package.image.size = response[0].size;
    FILESYSTEM.writeFile(build_dir + 'dappnode_package.json', JSON.stringify(dappnode_package, null, 2), 'utf-8', function(err) {
        if (err) {
            throw err;
        }
    });
    ipfs.pin.add(response[0].hash);
    return Promise.resolve("Image uploaded!");
}

function uploadManifest() {
    return new Promise(function(resolve, reject) {
        console.log("uploadManifest...");
        console.log(build_dir + "dappnode_package.json")
        var file = [build_dir + "dappnode_package.json"]
        ipfs.files.add(file, async function(err, files) {
            if (err) {
                throw err
            }
            FILESYSTEM.writeFile(build_dir + '/manifest.json', JSON.stringify(files, null, 2), 'utf-8', function(err) {
                if (err) {
                    throw err;
                }
            });
            ipfs.pin.add(files[0].hash);
            console.log(chalk.green('Manifest uploaded: ') + '/ipfs/' + files[0].hash);

            if (generateTX) {

                var contentURI = '0x' + (Buffer.from('/ipfs/' + files[0].hash, 'utf8').toString('hex'))
                console.log(chalk.green('contentURI: ') + contentURI);

                if (files[0].hash == 'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH') {
                    await uploadManifest();
                    resolve()
                } else {
                    apm.getRepository(dappnode_package.name)
                        .then((repository) => {
                            if (repository.options.address == '0x0000000000000000000000000000000000000000') {
                                console.log(chalk.red(dappnode_package.name + ' repo is not a valid repo'))
                                reject()
                            } else {
                                var rawTX = repository.methods.newVersion(dappnode_package.version.split('.'), '0x0000000000000000000000000000000000000000', contentURI).encodeABI();
                                console.log(chalk.green('\n##################################################################################'))
                                console.log(chalk.green('You must execute this transaction in mainnet to publish a new version of the package\nOnce it is minted you can install teh new version of your package through this ENS address:\n') + dappnode_package.name)
                                console.log(chalk.red('To be able to update this repository you must be the authorized dev.'))
                                console.log(chalk.green('########################### TX Info #####################################'))
                                console.log(chalk.green('To: ') + repository.options.address)
                                console.log(chalk.green('Value: ') + '0')
                                console.log(chalk.green('Data: ') + rawTX)
                                console.log(chalk.green('Gas Limit: ') + '300000')
                                console.log(chalk.green('##################################################################################'))

                                var stream = FILESYSTEM.createWriteStream(build_dir + "deploy.txt");
                                stream.once('open', function(fd) {
                                    stream.write('To: ' + repository.options.address + "\n");
                                    stream.write('Value: 0 \n');
                                    stream.write('Data: ' + rawTX + '\n');
                                    stream.write('Gas Limit: 300000\n');
                                    stream.end();
                                });
                                resolve();
                            }
                        })
                        .catch((error) => {
                            apm.getRepoRegistry(dappnode_package.name).then(async (registry) => {
                                if (registry.options.address == '0x0000000000000000000000000000000000000000') {
                                    console.log(chalk.red(dappnode_package.name + ' repo does not belong to a valid registry'))
                                } else {
                                    var rawTX = registry.methods.newRepoWithVersion(dappnode_package.name.split('.')[0], developer, dappnode_package.version.split('.'), '0x0000000000000000000000000000000000000000', contentURI).encodeABI();
                                    console.log(chalk.green('\n##################################################################################'))
                                    console.log(chalk.green('You must execute this transaction in mainnet to publish the package\nOnce it is minted you can install your package through this ENS address:\n') + dappnode_package.name)
                                    console.log(chalk.green('########################### TX Registry Info #####################################'))
                                    console.log(chalk.green('To: ') + registry.options.address)
                                    console.log(chalk.green('Value: ') + '0')
                                    console.log(chalk.green('Data: ') + rawTX)
                                    console.log(chalk.green('Gas Limit: ') + '1100000')
                                    console.log(chalk.green('##################################################################################'))
                                    var stream = FILESYSTEM.createWriteStream(build_dir + "deploy.txt");
                                    stream.once('open', function(fd) {
                                        stream.write('To: ' + registry.options.address + "\n");
                                        stream.write('Value: 0 \n');
                                        stream.write('Data: ' + rawTX + '\n');
                                        stream.write('Gas Limit: 1100000\n');
                                        stream.end();
                                    });
                                    resolve()
                                }
                            })
                        })
                }
            } else {
                resolve();
            }
        })
    });
}

function copyCompose(path, name) {
    FILESYSTEM.readdir('./', (err, files) => {
        for (var index in files) {
            if (files[index].endsWith(".yml")) {
                if (files[index].startsWith("docker-compose")) {
                    try {
                        FILESYSTEM.copyFile(files[index], path + "docker-compose-" + name.split('.')[0] + ".yml", (err) => {
                            if (err) throw err;
                        });
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
        }
    })
}

function copyEnv(path) {
    FILESYSTEM.readdir('./', (err, files) => {
        for (var index in files) {
            if (files[index].endsWith(".env")) {
                try {
                    FILESYSTEM.copyFile(files[index], path + files[index], (err) => {
                        if (err) throw err;
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        }
    })
}

module.exports = {
    newBuild
}