import fs from "fs";
import chalk from "chalk";
import { getPublishTxLink } from "./getLinks";
import { TxData } from "../types";
import { printObject } from "./print";

export function outputTxData({
  txData,
  toConsole,
  toFile
}: {
  txData: TxData;
  toConsole: string;
  toFile: string;
}): void {
  const adminUiLink = getPublishTxLink(txData);

  const txDataToPrint = {
    To: txData.to,
    Value: txData.value,
    Data: txData.data,
    "Gas limit": txData.gasLimit
  };

  const txDataString = printObject(
    txDataToPrint,
    (key, value) => `${key}: ${value}`
  );

  // If requested output txDataToPrint to file
  if (toFile) {
    fs.writeFileSync(
      toFile,
      `
${txDataString}

You can execute this transaction with Metamask by following this pre-filled link

${adminUiLink}

`
    );
  }

  const txDataStringColored = printObject(
    txDataToPrint,
    (key, value) => `  ${chalk.green(key)}: ${value}`
  );

  // If requested output txDataToPrint to console
  if (toConsole) {
    console.log(`
${chalk.green("Transaction successfully generated.")}
You must execute this transaction in mainnet to publish a new version of this DNP
To be able to update this repository you must be the authorized dev.

${chalk.gray("###########################")} TX data ${chalk.gray(
      "#############################################"
    )}

${txDataStringColored}

${chalk.gray(
  "#################################################################################"
)}

  You can execute this transaction with Metamask by following this pre-filled link

  ${adminUiLink}

${chalk.gray(
  "#################################################################################"
)}
`);
  }
}
