#!/usr/bin/env node

import yargs from "yargs";
import chalk from "chalk";
import figlet from "figlet";
import dotenv from "dotenv";

import { build } from "./commands/build";
import { fromGithub } from "./commands/from_github";
import { increase } from "./commands/increase";
import { init } from "./commands/init";
import { next } from "./commands/next";
import { publish } from "./commands/publish";
import { githubActions } from "./commands/githubActions";

// "source-map-support" MUST be imported for stack traces to work properly after Typescript transpile -
import "source-map-support/register";
import { CliError, defaultDir, YargsError } from "./params";
dotenv.config();

// Set up commands
const dappnodesdk = yargs
  .usage(`Usage: dappnodesdk <command> [options]`)
  .options({
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
  })
  .command(build)
  .command(fromGithub)
  .command(increase)
  .command(init)
  .command(next)
  .command(publish)
  .command(githubActions);

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
 * Handle errors:
 * - yargs parsing errors will come from the `msg` variable.
 *   In that case show the commands help and a message
 * - If there is no command, show the welcome message
 * - Otherwise, `err` will contain an error on unexpected errors.
 *   Just show the error with the stack
 * - #### TODO, track known errors and show them nicely
 */
dappnodesdk.fail((msg, err, yargs) => {
  // Rebrand custom errors as yargs native errors, to display help
  if (err instanceof YargsError) {
    msg = err.message;
    // @ts-ignore
    err = undefined;
  }

  if (err) {
    if (err instanceof CliError) {
      console.error(` ${chalk.red("✖")} ${err.message}\n`);
      process.exit(1);
    }
    // If the error is a network error, show the full error with status code and info
    if (err.name === "HttpError") console.error(err);
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
