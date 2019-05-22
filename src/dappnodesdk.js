#!/usr/bin/env node

// Node modules
const dappnodesdk = require("commander");
const figlet = require("figlet");
const chalk = require("chalk");
// Methods
const getNextVersionFromApm = require("./methods/getNextVersionFromApm");
const increaseFromLocalVersion = require("./methods/increaseFromLocalVersion");
const increaseFromApmVersion = require("./methods/increaseFromApmVersion");
const buildAndUpload = require("./methods/buildAndUpload");
const generatePublishTx = require("./methods/generatePublishTx");
const initializeDnp = require("./methods/initializeDnp");
const getCurrentLocalVersion = require("./methods/getCurrentLocalVersion");
// Utils
const {
  readManifest,
  writeManifest,
  manifestFromCompose
} = require("./utils/manifest");
const { readCompose, generateAndWriteCompose } = require("./utils/compose");
const outputTxData = require("./utils/outputTxData");
const warpErrors = require("./utils/warpErrors");

// Generic options for all commands
dappnodesdk
  .option("-d, --directory [dir]", "Change the default directory: ./")
  .option(
    "-s, --silent",
    "Prevent the command from outputing progress logs to the console"
  );

/**
 * INIT
 *
 * Initialize the repository
 */

dappnodesdk
  .command("init")
  .description("Initialize a new DAppNodePackage (DNP) repository")
  .option(
    "-y, --yes",
    `Answer yes or the default option to all initialization questions`
  )
  .action(
    warpErrors(async options => {
      const useDefaults = options.yes;
      const dir = options.parent.dir;
      await initializeDnp({ dir, useDefaults });
    })
  );

/**
 * BUILD
 *
 * Build a new version (only generates the ipfs hash)
 */

dappnodesdk
  .command("build")
  .description("Build a new version (only generates the ipfs hash)")
  .option(
    "-p, --provider [provider]",
    `Specify an ipfs provider: "dappnode" (default), "infura", "localhost:5002"`
  )
  .option(
    "-t, --timeout [timestring]",
    `Overrides default build timeout: "15h", "20min 15s", "5000". Specs npmjs.com/package/timestring`
  )
  .action(
    warpErrors(async options => {
      // Parse options
      const ipfsProvider = options.provider;
      const userTimeout = options.timeout;
      const dir = options.parent.dir || "./"; // general option
      const silent = options.parent.silent; // general option
      const nextVersion = getCurrentLocalVersion({ dir });
      const buildDir = `${dir}/build_${nextVersion}/`;
      // Execute command
      const manifestIpfsPath = await buildAndUpload({
        buildDir,
        ipfsProvider,
        userTimeout,
        silent
      });
      console.log(manifestIpfsPath);
    })
  );

/**
 * PUBLISH
 *
 * Publish a new version of the package in an Aragon Package Manager Repository. Type: [ major | minor | patch ]
 * @param {String} type < major | minor | patch >
 * @returns {String} transaction info to publish the next version
 */

dappnodesdk
  .command("publish <type>")
  .description(
    "Publish a new version of the package in an Aragon Package Manager Repository. Type: [ major | minor | patch ]"
  )
  .option(
    "-p, --provider [provider]",
    `Specify a provider (overwrittes ipfs_provider and eth_provider): "dappnode" (default), "infura", "http://localhost:8545"`
  )
  .option(
    "--eth_provider [provider]",
    `Specify an eth provider: "dappnode" (default), "infura", "localhost:5002"`
  )
  .option(
    "--ipfs_provider [provider]",
    `Specify an ipfs provider: "dappnode" (default), "infura", "http://localhost:8545"`
  )
  .option(
    "-a, --developer_address [address]",
    `If there is no existing repo for this DNP the publish command needs a developer address. If it is not provided as an option a prompt will request it`
  )
  .option(
    "-t, --timeout [timestring]",
    `Overrides default build timeout: "15h", "20min 15s", "5000". Specs: npmjs.com/package/timestring`
  )
  // .option('-e, --extra_item [item]', 'Add custom item to the list')
  // function to execute when command is uses
  .action(
    warpErrors(async (type, options) => {
      // Parse options
      const ethProvider = options.provider || options.eth_provider;
      const ipfsProvider = options.provider || options.ipfs_provider;
      const dir = options.parent.dir; // general option
      const developerAddress = options.developer_address;
      const userTimeout = options.timeout;
      const silent = options.parent.silent; // general option
      // Execute command
      // If the repo is not initialized yet, increaseFromApmVersion will throw
      let nextVersion;
      try {
        nextVersion = await increaseFromApmVersion({ type, ethProvider, dir });
      } catch (e) {
        if (e.message.includes("NOREPO"))
          nextVersion = getCurrentLocalVersion({ dir });
        else throw e;
      }
      const buildDir = `./build_${nextVersion}/`;
      const manifestIpfsPath = await buildAndUpload({
        buildDir,
        ipfsProvider,
        userTimeout,
        silent
      });
      const txData = await generatePublishTx({
        manifestIpfsPath,
        dir,
        developerAddress,
        ethProvider
      });
      // Output result. Only to console if it's not silent
      outputTxData({
        txData,
        toConsole: !silent,
        toFile: `${buildDir}/deploy.txt`
      });
    })
  );

/**
 * NEXT
 *
 * Get the next release version
 * @param {String} type < major | minor | patch >
 * @returns {String} next semver: 0.1.8
 */

dappnodesdk
  .command("next [type]")
  .description("Get the next release version. Type: [ major | minor | patch ]")
  .option(
    "-p, --provider [provider]",
    `Specify an eth provider: "dappnode" (default), "infura", "http://localhost:8545"`
  )
  .action(
    warpErrors(async (type, options) => {
      // Parse options
      const ethProvider = options.provider;
      const dir = options.parent.dir;
      // Execute command
      const nextVersion = await getNextVersionFromApm({
        type,
        ethProvider,
        dir
      });
      // Output result: "0.1.8"
      console.log(nextVersion);
    })
  );

/**
 * INCREASE
 *
 * Increases the version defined in the manifest
 * @param {String} type < major | minor | patch >
 * @returns {String} next semver: 0.1.8
 */

dappnodesdk
  .command("increase <type>")
  .description(
    "Increases the version defined in the manifest. Type: [ major | minor | patch ]"
  )
  .action(
    warpErrors(async (type, options) => {
      // Parse options
      const dir = options.parent.dir;
      // Execute command
      const nextVersion = await increaseFromLocalVersion({ type, dir });
      // Output result: "0.1.8"
      console.log(nextVersion);
    })
  );

/**
 * GEN_MANIFEST
 *
 * Generate a new manifest based on an existing docker-compose.yml
 * @returns {String} -
 */

dappnodesdk
  .command("gen_manifest")
  .description(
    "Generate a new manifest based on an existing docker-compose.yml"
  )
  // .option('-e, --extra_item [item]', 'Add custom item to the list')
  // function to execute when command is uses
  .action(
    warpErrors(async options => {
      const dir = options.parent.dir;
      const compose = readCompose({ dir });
      const manifest = manifestFromCompose(compose);
      writeManifest({ manifest, dir });
    })
  );

/**
 * GEN_COMPOSE
 *
 * Generate a new docker-compose.yml based on an existing dappnode_package.json
 * @returns {String} -
 */

dappnodesdk
  .command("gen_compose")
  .description(
    "Generate a new docker-compose.yml based on an existing dappnode_package.json"
  )
  // .option('-e, --extra_item [item]', 'Add custom item to the list')
  // function to execute when command is uses
  .action(
    warpErrors(async options => {
      const dir = options.parent.dir;
      const manifest = readManifest({ dir });
      generateAndWriteCompose({ manifest, dir });
    })
  );

/**
 * Additional help and customization
 * - When no command is provided display help
 * - When an unkown command is provided display help
 */

const sdkDescription =
  "dappnodesdk is a tool to make as simple as possible the creation of new dappnode packages. \n  It helps to initialize and publish an Aragon Package Manager Repo in the ethereum mainnet.";
const sdkVersion = require("../package.json").version;

// Show version in -v command
dappnodesdk.version(sdkVersion, "-v, --version");

// display help by default (e.g. if no command was provided)
// REF: https://www.npmjs.com/package/commander#outputhelpcb
if (!process.argv.slice(2).length) {
  // Display ascii art, then help
  console.log(`
${chalk.bold.hex("#2FBCB2")(figlet.textSync("    dappnode sdk"))}
\t\t\t\t\t\t\t\t${chalk.hex("#2FBCB2")(sdkVersion)}

  ${sdkDescription}

  To view available commands and options run:

    dappnodesdk --help

`);
}

// Display error message for unkown command. Show instructions to type the help command
dappnodesdk.command("*", { noHelp: true }).action(() => {
  console.log(`
  Unkown command. To view available commands and options run:

    dappnodesdk --help
`);
});

// Extend help by providing examples
dappnodesdk.on("--help", () => {
  console.log(`\nTutorial:
  https://github.com/dappnode/DAppNodeSDK
`);
});

dappnodesdk.parse(process.argv);
