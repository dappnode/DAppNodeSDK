const chalk = require("chalk");

function processExit(title, body) {
  if (title) console.log(chalk.red(title));
  if (body) console.log(body);
  console.log("\n");
  process.exit(1);
}

module.exports = processExit;
