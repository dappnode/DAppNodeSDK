const fs = require('fs');

function outputTxData({txData, toConsole, toFile}) {
  const txDataString = Object.keys(txData).map((key) => `${key}: ${txData[key]}`).join('\n');

  // If requested output txData to file
  if (toFile) {
    fs.writeFileSync(toFile, txDataString);
  }

  // If requested output txData to console
  if (toConsole) {
    console.log(`
#################################################################################
You must execute this transaction in mainnet to publish a new version of this DNP
To be able to update this repository you must be the authorized dev.
########################### TX data #############################################
${txDataString}
#################################################################################
`);
  }
}

module.exports = outputTxData;

