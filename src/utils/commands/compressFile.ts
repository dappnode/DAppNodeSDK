import { shell } from "../shell";

/**
 * In order for xz to output update logs to stderr,
 * a SIGALRM must be sent to the xz process every interval
 * https://stackoverflow.com/questions/48452726/how-to-redirect-xzs-normal-stdout-when-do-tar-xz
 */

export async function compressFile(
  path: string,
  options: { onData: (data: string) => void; timeout: number }
): Promise<string> {
  const { timeout, onData } = options || {};
  /**
   * -e9T0: Compression settings (extreme and paralelized)
   * -vv: Very verbose log to provide progress
   * -f: overwrite the destination path if necessary
   */
  const cmdOg = `xz -e9T0 -vv -f ${path}`;
  const cmd = `${cmdOg} & xz_pid=$!
while sleep 1; do
  kill -ALRM "$xz_pid" || break
done
wait "$xz_pid"`;

  try {
    return await shell(cmd, { timeout, onData, maxBuffer: 100 * 1e6 });
  } catch (e) {
    e.message = `Error compressing ${path}: ${e.message}`;
    throw e;
  }
}
