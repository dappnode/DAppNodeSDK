import { shell } from "../src/utils/shell";

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

export const shellSafe = (cmd: string): Promise<string | void> =>
  shell(cmd).catch(console.debug);
export const rmSafe = (path: string): Promise<string | void> =>
  shellSafe(`rm -r ${path}`);
export const mkdirSafe = (path: string): Promise<string | void> =>
  shellSafe(`mkdir -p ${path}`);
