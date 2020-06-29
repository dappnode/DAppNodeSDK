import execa from "execa";

/**
 * In order for xz to output update logs to stderr,
 * a SIGALRM must be sent to the xz process every interval
 * https://stackoverflow.com/questions/48452726/how-to-redirect-xzs-normal-stdout-when-do-tar-xz
 */

export function compressFile(path, { logger, timeout }) {
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
  let stderr = "";
  const xz = execa.shell(cmd, { timeout });
  return new Promise((resolve, reject) => {
    xz.stderr.on("data", chunk => {
      const data = chunk.toString().trim();
      stderr = data;
      logger(data);
    });
    xz.stdout.on("data", chunk => {
      const data = chunk.toString().trim();
      logger(data);
    });
    xz.on("close", code => {
      // execa can return null or 0
      if (!code) resolve();
      else reject(Error(`Error compressing ${path}: ${stderr}`));
    });
  });
}
