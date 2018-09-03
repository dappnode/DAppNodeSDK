#!/usr/bin/env node

const FILESYSTEM = require('fs')
const chalk = require('chalk')
const cmd = require('commander')
const figlet = require('figlet')
const semver = require('semver')
const INQUIRER = require('inquirer')
const yaml = require('js-yaml')

const apm = require('./apm')
const init = require('./init')
const build = require('./build')
const generateManifest = require('./generateManifest')
const generateCompose = require('./generateCompose')

const MANIFEST_NAME = 'dappnode_package.json'
const DOCKERCOMPOSE = 'docker-compose.yml'
const DAPPNODE_SDK_VERSION = '0.1.0-rc1'

cmd.option('init', 'Initialize a new DAppNodePackage Repo')
    .option('gen_manifest', 'Generate a new manifest based on a existing docker-compose.yml')
    .option('gen_compose', 'Generate a new docker-compose.yml based on a existing dappnode_package.json')
    .option('build', 'build a new version')
    .option('new <type>', 'apm repo', /^(major|minor|patch)$/i)
    .parse(process.argv)

if (process.argv.length === 2) {
    initalMessage().then(function() {
        var promise = new Promise(function(resolve, reject) {
            setTimeout(function() {
                console.log('Usage: ' + chalk.red('dappnodesdk [option]'))
                console.log('       ' + chalk.red('dappnodesdk --help') +
                    '\t to view available options\n')
                resolve({ data: '200' })
            }, 200)
        })
        return promise
    })
}

function initalMessage() {
    return new Promise(function(resolve, reject) {
        figlet.text('    dappnode sdk    ', {
            font: 'Ogre',
            horizontalLayout: 'default',
            verticalLayout: 'default'
        }, function(err, data) {
            if (err) {
                console.log('Error', err)
                reject()
            }
            console.log(chalk.bold.hex('#2FBCB2')(data))
            console.log(chalk.hex('#2FBCB2')('\t\t\t\t\t\t\t\t' + DAPPNODE_SDK_VERSION))
            resolve()
        })
    })
}

if (cmd.new) {
    initalMessage().then(() => {
        var dappnode_package = JSON.parse(FILESYSTEM.readFileSync('dappnode_package.json', 'utf8'));
        apm.getLatestVersion(dappnode_package.name).then(async (version) => {
            dappnode_package.version = semver.inc(version.version, cmd.new)
            generateManifest.generateManifest(dappnode_package);
            generateCompose.generateCompose(JSON.parse(FILESYSTEM.readFileSync(MANIFEST_NAME)));
            console.log('Next version: ' + dappnode_package.version)
            await INQUIRER.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    default: false,
                    message: 'Do you want to build it?',
                },
            ]).then(async (answer) => { if (answer.confirm) await build.newBuild(); apm.closeProvider() });
        }).catch((error) => {
            apm.getRepoRegistry(dappnode_package.name).then(async (a) => {
                await INQUIRER.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        default: false,
                        message: 'the Aragon Package Manager repo does not exist, do you want to create a new one?',
                    },
                ]).then(async (answer) => {
                    if (answer.confirm) {
                        INQUIRER.prompt([
                            {
                                type: 'input',
                                name: 'dev',
                                default: '0x0000000000000000000000000000000000000000',
                                message: 'Developer address',
                            }
                        ]).then(async (ans) => { await build.newBuild(ans.dev); apm.closeProvider() })
                    }
                });
            }).catch((error) => { 
                console.log(chalk.red(dappnode_package.name + ' repo does not belong to a valid registry'))
                apm.closeProvider()
            })
        });
    });
}

if (cmd.init) {
    initalMessage().then(() => {
        init.DappNodePackageRepo();
    });
}

/*
 * Generate docker-compose.yml
 */
if (cmd.gen_compose) {
    initalMessage().then(async () => {
        if (FILESYSTEM.existsSync(MANIFEST_NAME)) {
            if (FILESYSTEM.existsSync(DOCKERCOMPOSE)) {
                await INQUIRER.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        default: false,
                        message: 'Are you sure you want to overwrite it?',
                    },
                ]).then((answer) => { if (!answer.confirm) process.exit(0) });
            }
            generateCompose.generateCompose(JSON.parse(FILESYSTEM.readFileSync(MANIFEST_NAME)));
        } else {
            console.log(MANIFEST_NAME + " does not exist, this command must be executed in a DAppnodePackage directory")
        }
    });
}

/*
 * Generate package.json
 */
if (cmd.gen_manifest) {
    initalMessage().then(async () => {
        if (FILESYSTEM.existsSync(DOCKERCOMPOSE)) {
            if (FILESYSTEM.existsSync(MANIFEST_NAME)) {
                await INQUIRER.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        default: false,
                        message: 'Are you sure you want to overwrite it?',
                    },
                ]).then((answer) => { if (!answer.confirm) process.exit(0) });
            }

            // Get document, or throw exception on error
            try {
                var dockercompose = yaml.safeLoad(FILESYSTEM.readFileSync(DOCKERCOMPOSE, 'utf8'));
                var manifestDefinition = await generateManifest.manifestFromCompose(dockercompose);
                generateManifest.generateManifest(manifestDefinition);

            } catch (e) {
                console.log(e);
            }
        } else {
            console.log(DOCKERCOMPOSE + " does not exist, this command must be executed in a DAppnodePackage directory")
        }
    });
}

if (cmd.build) {
    initalMessage().then(async () => {
        build.newBuild();
    })
}