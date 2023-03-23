import rimraf from "rimraf";
import { promisify } from "util.js";
import { shell } from "../src/utils/shell.js";

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

function printShellSafeError(e: Error) {
  if (process.env.PRINT_SHELL_SAFE_ERRORS) console.log(e);
}

export const shellSafe = (cmd: string): Promise<string | void> =>
  shell(cmd).catch(printShellSafeError);
export const rmSafe = (path: string): Promise<string | void> =>
  promisify(rimraf)(path);
export const mkdirSafe = (path: string): Promise<string | void> =>
  shellSafe(`mkdir -p ${path}`);
