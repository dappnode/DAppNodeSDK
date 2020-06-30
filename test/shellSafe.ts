import { shell } from "../src/utils/shell";

/**
 * General purpose tool to make sure test files are gone without producing errors
 */

export const shellSafe = (cmd: string) => shell(cmd).catch(() => {});
export const rmSafe = (path: string) => shellSafe(`rm -r ${path}`);
export const mkdirSafe = (path: string) => shellSafe(`mkdir -p ${path}`);
