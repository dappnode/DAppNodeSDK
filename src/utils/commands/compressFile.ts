import fs from "fs";
import { spawn } from "child_process";

export async function compressFile({
  srcPath,
  destPath,
  onData,
  timeout
}: {
  srcPath: string;
  destPath: string;
  onData?: (data: string) => void;
  timeout?: number;
}): Promise<string> {
  // -e9T0: Compression settings (extreme and paralelized)
  // -vv: Very verbose log to provide progress
  // -c: Outputs the compressed result to stdout
  // -f: Overwrite the destination path if necessary
  const xz = spawn("xz", ["-e9T0", "-vv", "-c", "-f", srcPath], {
    timeout
  });

  let lastStderr = "";
  xz.stderr.on("data", chunk => {
    const data = chunk.toString().trim();
    lastStderr = data;
    if (onData) onData(data);
  });

  xz.stdout.pipe(fs.createWriteStream(destPath));

  // In order for xz to output update logs to stderr,
  // a SIGALRM must be sent to the xz process every interval
  // https://stackoverflow.com/questions/48452726/how-to-redirect-xzs-normal-stdout-when-do-tar-xz
  const interval = setInterval(() => xz.kill("SIGALRM"), 1000);

  return new Promise((resolve, reject) => {
    xz.on("error", err => {
      clearInterval(interval);
      reject(
        Error(`Error compressing ${srcPath}: ${err.message} \n${lastStderr}`)
      );
    });

    xz.on("exit", code => {
      clearInterval(interval);
      if (code) {
        reject(
          Error(`Error compressing ${srcPath}: xz exit ${code} \n${lastStderr}`)
        );
      } else {
        resolve();
      }
    });
  });
}
