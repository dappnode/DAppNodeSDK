const execa = require("execa");

/**
 * In order for xz to output update logs to stderr,
 * a SIGALRM must be sent to the xz process every interval
 * https://stackoverflow.com/questions/48452726/how-to-redirect-xzs-normal-stdout-when-do-tar-xz
 */

function compressFile(path, { logger, timeout }) {
  const cmdOg = `xz -e9T0 -vv -k -f ${path}`;
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
      if (code === 0) resolve();
      else reject(Error(`Error compressing ${path}: ${stderr}`));
    });
  });
}

module.exports = compressFile;
