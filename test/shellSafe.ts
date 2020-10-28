import { shell } from "../src/utils/shell";
import fs from 'fs'
import { Buffer } from "buffer";
import rimraf from 'rimraf'

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

function printShellSafeError(e: Error) {
  if (process.env.PRINT_SHELL_SAFE_ERRORS) console.log(e);
}

export const shellSafe = (cmd: string): Promise<string | void> =>
  shell(cmd).catch(printShellSafeError);
export const rmSafe = (path: string): void =>
  rimraf.sync(path)
export const mkdirSafe = (path: string): Promise<string | void> =>
  fs.promises.mkdir(path, {recursive: true})
