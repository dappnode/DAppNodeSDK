const fs = require('fs');
const chalk = require('chalk');

function outputTxData({txData, toConsole, toFile}) {
  const txDataString = Object.keys(txData).map((key) => `${key}: ${txData[key]}`).join('\n');

  // If requested output txData to file
  if (toFile) {
    fs.writeFileSync(toFile, txDataString);
  }

  const txDataStringColored = Object.keys(txData).map(
      (key) => `${chalk.green(key)}: ${txData[key]}`
  ).join('\n');

  // If requested output txData to console
  if (toConsole) {
    console.log(`
${chalk.green('Transaction successfully generated.')}
You must execute this transaction in mainnet to publish a new version of this DNP
To be able to update this repository you must be the authorized dev.

${chalk.gray('###########################')} TX data ${chalk.gray('#############################################')}

${txDataStringColored}

${chalk.gray('#################################################################################')}
`);
  }
}

module.exports = outputTxData;

