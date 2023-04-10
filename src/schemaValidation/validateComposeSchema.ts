import { CliError } from "../params.js";
import { shell } from "../utils/shell.js";
import fs from "fs";

/**
 * Validates compose file with docker-compose config
 * @param compose
 */
export async function validateComposeSchema(
  composeFilePath: string
): Promise<void> {
  if (!fs.existsSync(composeFilePath))
    throw Error(`Compose file ${composeFilePath} not found`);
  await shell(`docker-compose -f ${composeFilePath} config`).catch(e => {
    throw new CliError(`Invalid compose:\n${e.stderr}`);
  });
}
