const FILESYSTEM = require('fs')
const SHELL = require('shelljs')
const ipfsAPI = require('ipfs-api')
const ipfs = ipfsAPI('my.ipfs.dnp.dappnode.eth')
const apm = require('./apm')
const chalk = require('chalk')
var Web3 = require('web3')
var ENS_ABI = [{ "constant": true, "inputs": [{ "name": "node", "type": "bytes32" }], "name": "resolver", "outputs": [{ "name": "", "type": "address" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "node", "type": "bytes32" }], "name": "owner", "outputs": [{ "name": "", "type": "address" }], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "node", "type": "bytes32" }, { "name": "label", "type": "bytes32" }, { "name": "owner", "type": "address" }], "name": "setSubnodeOwner", "outputs": [], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "node", "type": "bytes32" }, { "name": "ttl", "type": "uint64" }], "name": "setTTL", "outputs": [], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "node", "type": "bytes32" }], "name": "ttl", "outputs": [{ "name": "", "type": "uint64" }], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "node", "type": "bytes32" }, { "name": "resolver", "type": "address" }], "name": "setResolver", "outputs": [], "payable": false, "type": "function" }, { "constant": false, "inputs": [{ "name": "node", "type": "bytes32" }, { "name": "owner", "type": "address" }], "name": "setOwner", "outputs": [], "payable": false, "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "node", "type": "bytes32" }, { "indexed": false, "name": "owner", "type": "address" }], "name": "Transfer", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "node", "type": "bytes32" }, { "indexed": true, "name": "label", "type": "bytes32" }, { "indexed": false, "name": "owner", "type": "address" }], "name": "NewOwner", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "node", "type": "bytes32" }, { "indexed": false, "name": "resolver", "type": "address" }], "name": "NewResolver", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "node", "type": "bytes32" }, { "indexed": false, "name": "ttl", "type": "uint64" }], "name": "NewTTL", "type": "event" }];
var ENS_ADDRESS = '0x314159265dD8dbb310642f98f50C066173C1259b'
var apmregistryfactoryAbi = [{ "constant": true, "inputs": [], "name": "REPO_APP_NAME", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "APM_APP_NAME", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "ENS_SUB_APP_NAME", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "registryBase", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "ensSubdomainRegistrarBase", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "ens", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "daoFactory", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_tld", "type": "bytes32" }, { "name": "_label", "type": "bytes32" }, { "name": "_root", "type": "address" }], "name": "newAPM", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "repoBase", "outputs": [{ "name": "", "type": "address" }], "payable": false, "stateMutability": "view", "type": "function" }, { "inputs": [{ "name": "_daoFactory", "type": "address" }, { "name": "_registryBase", "type": "address" }, { "name": "_repoBase", "type": "address" }, { "name": "_ensSubBase", "type": "address" }, { "name": "_ens", "type": "address" }, { "name": "_ensFactory", "type": "address" }], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "node", "type": "bytes32" }, { "indexed": false, "name": "apm", "type": "address" }], "name": "DeployAPM", "type": "event" }];
var Web3 = require('web3');

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

            var contentURI = '0x' + (Buffer.from('/ipfs/' + files[0].hash, 'utf8').toString('hex'))
            console.log(chalk.green('contentURI: ') + contentURI);

            if (files[0].hash == 'QmbFMke1KXqnYyBBWxB74N4c5SBnJMVAiMNRcGu6x1AwQH') {
                await uploadManifest();
                resolve()
            } else {
                console.log(dappnode_package.name)
                apm.getRepository(dappnode_package.name)
                    .then((repository) => {
                        if (repository.options.address == '0x0000000000000000000000000000000000000000') {
                            console.log(chalk.red(dappnode_package.name + ' repo is not a valid repo'))
                            reject()
                        } else {
                            var rawTX = repository.methods.newVersion(dappnode_package.version.split('.'), '0x0000000000000000000000000000000000000000', contentURI).encodeABI();
                            console.log(chalk.green('\n########################### TX Info #####################################'))
                            console.log(chalk.green('To: ') + repository.options.address)
                            console.log(chalk.green('Value: ') + '0')
                            console.log(chalk.green('Data: ') + rawTX)
                            console.log(chalk.green('Gas Limit: ') + '300000')
                            resolve();
                        }
                    })
                    .catch((error) => {
                        apm.getRepoRegistry(dappnode_package.name).then(async (registry) => {
                            if (registry.options.address == '0x0000000000000000000000000000000000000000') {
                                console.log(chalk.red(dappnode_package.name + ' repo does not belong to a valid registry'))
                            } else {
                                var rawTX = registry.methods.newRepoWithVersion(dappnode_package.name.split('.')[0], developer, dappnode_package.version.split('.'), '0x0000000000000000000000000000000000000000', contentURI).encodeABI();
                                console.log(chalk.green('\n########################### TX Registry Info #####################################'))
                                console.log(chalk.green('To: ') + registry.options.address)
                                console.log(chalk.green('Value: ') + '0')
                                console.log(chalk.green('Data: ') + rawTX)
                                console.log(chalk.green('Gas Limit: ') + '1100000')
                                resolve()
                            }
                        })
                    })
            }
        })
    });
}

async function newRegistry(dev = '0x0000000000000000000000000000000000000000') {
    developer = dev;
    dappnode_package = JSON.parse(FILESYSTEM.readFileSync('dappnode_package.json', 'utf8'));

    web3 = new Web3('ws://my.ethchain.dnp.dappnode.eth:8546')

    var ens = new web3.eth.Contract(ENS_ABI, ENS_ADDRESS);

    var root = dappnode_package.name.split('.').slice(2).join('.');
    console.log("Root domain: " + root)
    var registry = dappnode_package.name.split('.')[1];
    console.log("Registry_name: " + registry)

    var onwer = await ens.methods.owner(namehash(registry + '.' + root)).call()
    console.log(onwer)

    if (onwer != '0x8f64c5e21c4c5b5aedb102e7cacd07ef101bdc7d') {
        await txSetSubnodeOwner(ens, dappnode_package);
    } else {
        await newAPM();
    }
}

function txSetSubnodeOwner(ens, dappnode_package) {
    return new Promise(async function(resolve, reject) {
        var root = dappnode_package.name.split('.').slice(2).join('.');
        var registry = dappnode_package.name.split('.')[1];
        var tx_ens_setsubnodeowner = ens.methods.setSubnodeOwner(namehash(root), web3.utils.sha3(registry), '0x8f64c5e21c4c5b5aedb102e7cacd07ef101bdc7d').encodeABI();
        console.log(chalk.green('\n##########################################################################################################################################'))
        console.log(chalk.yellow('The owner of the domain is not the APMRegistryFactory. This is necessary to deploy the registry associated with your domain.'))
        console.log(chalk.yellow('Therefore it is highly recommended to create a sub-domain (do not use the root domain) for this purpose.'))
        console.log(chalk.yellow('i.e: dnp.dappnode.eth, registry.dappnode.eth, apm.dappnode.eth or similar'));
        console.log(chalk.yellow('In order to create ' + chalk.red(registry + '.' + root) + ' sub-domain and give the onwer to the APMRegistryFactory you should execute the following transaction:'));
        console.log(chalk.green('############################################### TX to create a sub-domain for the registry ###############################################'))
        console.log(chalk.green('To: ') + ENS_ADDRESS)
        console.log(chalk.green('Value: ') + '0')
        console.log(chalk.green('Data: ') + tx_ens_setsubnodeowner)
        console.log(chalk.green('Gas Limit: ') + '80000')
        console.log(chalk.green('############################################### TX to create a sub-domain for the registry ###############################################'))
        console.log(chalk.yellow('After this transaction is mined it will be necessary to execute another one to create a new registry'));
        console.log('Waiting for the TX to create a sub-domain for the registry to be mined...');

        ens.events.NewOwner({
            filter: {
                node: namehash(root),
                label: web3.utils.sha3(registry)
            },
            fromBlock: 6000000
        }, async function(error, event) {
            console.log('transactionHash: ' + event.transactionHash);
            await newAPM(ens, dappnode_package);
            resolve(event)
        })
    })
}

function newAPM(ens, dappnode_package) {
    return new Promise(async function(resolve, reject) {

        var root = dappnode_package.name.split('.').slice(2).join('.');
        var registry = dappnode_package.name.split('.')[1];

        var apmregistryfactory = new web3.eth.Contract(apmregistryfactoryAbi, '0x8f64c5e21c4c5b5aedb102e7cacd07ef101bdc7d');
        var apmregistryfactory_tx = apmregistryfactory.methods.newAPM(namehash(root), web3.utils.sha3(registry), developer).encodeABI();

        console.log(chalk.green('\n########################### TX new APM Registry #####################################'))
        console.log(chalk.green('To: ') + '0x8f64c5e21c4c5b5aedb102e7cacd07ef101bdc7d')
        console.log(chalk.green('Value: ') + '0')
        console.log(chalk.green('Data: ') + apmregistryfactory_tx)
        console.log(chalk.green('Gas Limit: ') + '6450000')
        console.log(chalk.green('########################### TX new APM Registry #####################################'))
        console.log('Waiting for the TX to create a new APM Registry to be mined...');

        apmregistryfactory.events.DeployAPM({
            filter: {
                node: namehash(registry + '.' + root)
            },
            fromBlock: 6000000
        }, async function(error, event) {
            console.log('transactionHash: ' + event.transactionHash);
            await newBuild();
            resolve(event)
        })
    })
}

function namehash(name) {
    var node = '0x0000000000000000000000000000000000000000000000000000000000000000';
    if (name != '') {
        var labels = name.split(".");
        for (var i = labels.length - 1; i >= 0; i--) {
            node = web3.utils.sha3(node + web3.utils.sha3(labels[i]).slice(2), { encoding: 'hex' });
        }
    }
    return node.toString();
}

module.exports = {
    newBuild,
    newRegistry
}