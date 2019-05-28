#!/usr/bin/env node

const chalk = require("chalk");
const figlet = require("figlet");

// Set up commands
const dappnodesdk = require("yargs")
  .usage(`Usage: dappnodesdk <command> [options]`)
  .commandDir("./commands");

dappnodesdk.alias("h", "help");
dappnodesdk.alias("v", "version");

// Set global options
dappnodesdk.option("silent", {
  description: "Silence output to terminal"
});

dappnodesdk.option("verbose", {
  description: "Show more output to terminal",
  alias: "debug",
  coerce: debug => {
    if (debug || process.env.DEBUG) {
      global.DEBUG_MODE = true;
      return true;
    }
  }
});

// blank scriptName so that help text doesn't display "aragon" before each command
dappnodesdk.scriptName("");

// Display ascii art, then help
const welcomeMsg = chalk.bold.hex("#2FBCB2")(
  figlet.textSync("    dappnode sdk")
);
dappnodesdk.demandCommand(1, welcomeMsg);

dappnodesdk.epilogue(
  "For more information, https://github.com/dappnode/DAppNodeSDK"
);

/**
 * Handle errors:
 * - yargs parsing errors will come from the `msg` variable.
 *   In that case show the commands help and a message
 * - If there is no command, show the welcome message
 * - Otherwise, `err` will contain an error on unexpected errors.
 *   Just show the error with the stack
 * - #### TODO, track known errors and show them nicely
 */
dappnodesdk.fail(function(msg, err, yargs) {
  if (err) {
    console.error(err.stack);
    process.exit(1);
  } else if (msg === welcomeMsg) {
    console.log(welcomeMsg + "\n");
    yargs.showHelp();
  } else if (msg) {
    console.error(`
${yargs.help()}
${chalk.gray(`
${"#".repeat(80)}
${"#".repeat(80)}
`)}
${msg}
`);
  } else {
    console.error("Unknown error");
  }
  process.exit(1);
});

// Run CLI
dappnodesdk.parse();

// Methods
// const getNextVersionFromApm = require("./methods/getNextVersionFromApm");
// const increaseFromLocalVersion = require("./methods/increaseFromLocalVersion");
// const increaseFromApmVersion = require("./methods/increaseFromApmVersion");
// const buildAndUpload = require("./methods/buildAndUpload");
// const generatePublishTx = require("./methods/generatePublishTx");
// const initializeDnp = require("./methods/initializeDnp");
// const getCurrentLocalVersion = require("./methods/getCurrentLocalVersion");
// // Utils
// const {
//   readManifest,
//   writeManifest,
//   manifestFromCompose
// } = require("./utils/manifest");
// const { readCompose, generateAndWriteCompose } = require("./utils/compose");
// const outputTxData = require("./utils/outputTxData");
// const warpErrors = require("./utils/warpErrors");

// Generic options for all commands
// dappnodesdk
//   .option("-d, --directory [dir]", "Change the default directory: ./")
//   .option(
//     "-s, --silent",
//     "Prevent the command from outputing progress logs to the console"
//   );

/**
 * Additional help and customization
 * - When no command is provided display help
 * - When an unkown command is provided display help
 */

// const sdkDescription =
//   "dappnodesdk is a tool to make as simple as possible the creation of new dappnode packages. \n  It helps to initialize and publish an Aragon Package Manager Repo in the ethereum mainnet.";
// const sdkVersion = require("../package.json").version;

// Show version in -v command
// dappnodesdk.version(sdkVersion, "-v, --version");

// display help by default (e.g. if no command was provided)
// REF: https://www.npmjs.com/package/commander#outputhelpcb
// if (!process.argv.slice(2).length) {
//   // Display ascii art, then help
//   console.log(`
// ${chalk.bold.hex("#2FBCB2")(figlet.textSync("    dappnode sdk"))}
// \t\t\t\t\t\t\t\t${chalk.hex("#2FBCB2")(sdkVersion)}

//   ${sdkDescription}

//   To view available commands and options run:

//     dappnodesdk --help

// `);
// }

// Display error message for unkown command. Show instructions to type the help command
// dappnodesdk.command("*", { noHelp: true }).action(() => {
//   console.log(`
//   Unkown command. To view available commands and options run:

//     dappnodesdk --help
// `);
// });

// Extend help by providing examples
// dappnodesdk.on("--help", () => {
//   console.log(`\nTutorial:
//   https://github.com/dappnode/DAppNodeSDK
// `);
// });

// dappnodesdk.parse(process.argv);
