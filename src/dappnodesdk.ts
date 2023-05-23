#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import figlet from "figlet";
import dotenv from "dotenv";

import { build } from "./commands/build.js";
import { fromGithub } from "./commands/from_github.js";
import { increase } from "./commands/increase.js";
import { init } from "./commands/init.js";
import { next } from "./commands/next.js";
import { publish } from "./commands/publish.js";
import { githubActions } from "./commands/githubActions/index.js";

// "source-map-support" MUST be imported for stack traces to work properly after Typescript transpile -
import "source-map-support/register.js";
import { defaultDir } from "./params.js";
dotenv.config();

process.on("uncaughtException", err => {
  console.error(` ${chalk.red("✖")} Uncaught exception ${err}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    ` ${chalk.red(
      "✖"
    )} Unhandled promise rejection at ${promise}, reason: ${reason}`
  );
  process.exit(1);
});

const dappnodesdk = yargs(hideBin(process.argv));

// Set up commands
dappnodesdk.usage(`Usage: dappnodesdk <command> [options]`);
dappnodesdk.options({
  // Set global options
  dir: {
    alias: "directory",
    description: "Change the base directory",
    default: defaultDir,
    type: "string"
  },
  compose_file_name: {
    description: `Compose file for docker-compose`,
    default: "docker-compose.yml",
    type: "string"
  },
  silent: {
    description: "Silence output to terminal",
    type: "boolean"
  },
  verbose: {
    description: "Show more output to terminal",
    alias: "debug",
    coerce: debug => {
      if (debug || process.env.DEBUG) {
        // @ts-ignore
        global.DEBUG_MODE = true;
        return true;
      }
    },
    type: "boolean"
  }
});
dappnodesdk.command(build);
dappnodesdk.command(fromGithub);
dappnodesdk.command(increase);
dappnodesdk.command(init);
dappnodesdk.command(next);
dappnodesdk.command(publish);
dappnodesdk.command(githubActions);

dappnodesdk.alias("h", "help");
dappnodesdk.alias("v", "version");

// blank scriptName so that help text doesn't display the cli name before each command
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
 * Handle errors
 */
dappnodesdk.fail((msg, err, yargs) => {
  if (err) {
    console.error(` ${chalk.red("✖")} ${err.message}\n`);
    throw err;
  } else {
    // If no specific error object is passed, use the message
    console.error(` ${chalk.red("✖")} ${msg}\n`);
    // Displaying the help
    console.log(yargs.help());
  }
});

// Run CLI
dappnodesdk.parse();
