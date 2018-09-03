const FILESYSTEM = require('fs')
const SHELL = require('shelljs')
const ipfsAPI = require('ipfs-api')
const ipfs = ipfsAPI('my.ipfs.dnp.dappnode.eth')
const apm = require('./apm')
const chalk = require('chalk')


var dappnode_package;
var developer;

async function newBuild(dev = '0x0000000000000000000000000000000000000000') {
    developer = dev;
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


        ipfs.files.add(file, { progress: (prog) => console.log('Uploading... ' + ((prog / FILESYSTEM.statSync(build_dir + image_name + ".tar.xz").size) * 100).toFixed(2) + "%") })
            .then((response) => {
                dappnode_package.image.path = response[0].path;
                dappnode_package.image.hash = '/ipfs/' + response[0].hash;
                dappnode_package.image.size = response[0].size;
                FILESYSTEM.writeFile(build_dir + 'dappnode_package.json', JSON.stringify(dappnode_package, null, 2), 'utf-8', function(err) {
                    if (err) {
                        throw err;
                    }
                });
                ipfs.pin.add(response[0].hash);
                resolve("Image uploaded!");
            }).catch((err) => {
                console.error(err)
            })
    });
}

function uploadManifest() {
    return new Promise(function(resolve, reject) {
        console.log("uploadManifest...");
        console.log(build_dir + "dappnode_package.json")
        var file = [build_dir + "dappnode_package.json"]
        ipfs.files.add(file, function(err, files) {
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

            var contentURI = '0x' + (Buffer.from('/ipfs/' + files[0].hash, 'utf8').toString('hex'))
            console.log(chalk.green('contentURI: ') + contentURI);

            apm.getRepository(dappnode_package.name)
                .then((repository) => {
                    if(registry.options.address == '0x0000000000000000000000000000000000000000'){
                        console.log(chalk.red(dappnode_package.name + ' repo is not a valid repo'))
                    }else {
                        var rawTX = repository.methods.newVersion(dappnode_package.version.split('.'), '', contentURI).encodeABI();
                        console.log(chalk.green('\n########################### TX Info #####################################'))
                        console.log(chalk.green('To: ') + repository.options.address + chalk.green('\nData: ') + rawTX)
                        resolve();
                    }
                }).catch((error)=>{
                    apm.getRepoRegistry(dappnode_package.name).then(async (registry) => {
                        if(registry.options.address == '0x0000000000000000000000000000000000000000'){
                            console.log(chalk.red(dappnode_package.name + ' repo does not belong to a valid registry'))
                        }else {
                            var rawTX = registry.methods.newRepoWithVersion(dappnode_package.name.split('.')[0],developer,dappnode_package.version.split('.'),'',contentURI).encodeABI();
                            console.log(chalk.green('\n########################### TX Registry Info #####################################'))
                            console.log(chalk.green('To: ') + registry.options.address + chalk.green('\nData: ') + rawTX)
                            resolve()
                        }

                    })
                })

        })
    });
}

module.exports = {
    newBuild
}