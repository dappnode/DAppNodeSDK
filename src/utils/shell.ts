import {
  exec,
  execFile,
  ExecException,
  ExecFileException
} from "child_process";
import { StringDecoder } from "string_decoder";

/**
 * If timeout is greater than 0, the parent will send the signal
 * identified by the killSignal property (the default is 'SIGTERM')
 * if the child runs longer than timeout milliseconds.
 */

const defaultTimeout = 3 * 60 * 1000; // ms
const defaultMaxBuffer = 1e7; // bytes

/**
 * Execute an argument array directly, or an intentional shell script as a string.
 * Stream complete output lines while retaining stdout/stderr for failure diagnostics.
 */
export async function shell(
  cmd: string | string[],
  options?: {
    timeout?: number;
    maxBuffer?: number;
    pipeToMain?: boolean;
    onData?: (data: string) => void;
    cwd?: string;
  }
): Promise<string> {
  const {
    timeout = defaultTimeout,
    maxBuffer = defaultMaxBuffer,
    pipeToMain = false,
    onData,
    cwd
  } = options || {};

  return new Promise((resolve, reject): void => {
    const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
    const callback = (
      err: ExecException | ExecFileException | null,
      stdout: string,
      stderr: string
    ): void => {
      if (err) {
        // Rethrow a typed error, and ignore the internal NodeJS stack trace
        reject(new ShellError(err, { stdout, stderr, cmd: cmdStr }));
      } else {
        resolve(stdout.trim() || stderr);
      }
    };
    // Arrays are arguments, never shell source. Use strings only for intentional scripts.
    const proc = Array.isArray(cmd)
      ? execFile(
          cmd[0],
          cmd.slice(1),
          { timeout, maxBuffer, cwd, encoding: "utf8" },
          callback
        )
      : exec(cmd, { timeout, maxBuffer, cwd, encoding: "utf8" }, callback);
    if (pipeToMain) {
      if (proc.stdout) proc.stdout.pipe(process.stdout);
      if (proc.stderr) proc.stderr.pipe(process.stderr);
    }
    if (onData) {
      for (const stream of [proc.stdout, proc.stderr]) {
        if (!stream) continue;
        const decoder = new StringDecoder("utf8");
        let pending = "";
        const flush = (text: string): void => {
          pending += text;
          const lines = pending.split(/\r\n|[\r\n]/);
          pending = lines.pop() || "";
          for (const line of lines) if (line.trim()) onData(line);
          // Keep malformed/no-newline process output bounded as well.
          if (pending.length > 65536) {
            onData(pending.slice(0, 65536));
            pending = pending.slice(65536);
          }
        };
        stream.on("data", (chunk: Buffer) => flush(decoder.write(chunk)));
        stream.on("end", () => {
          flush(decoder.end());
          if (pending.trim()) onData(pending);
        });
      }
    }
  });
}

/**
 * Typed error implementing the native node child exception error
 * Can be rethrow to ignore the internal NodeJS stack trace
 */
export class ShellError extends Error {
  cmd?: string;
  killed?: boolean;
  code?: string | number | null;
  signal?: NodeJS.Signals;
  stdout: string;
  stderr: string;
  constructor(
    e: ExecException | ExecFileException,
    { cmd, stdout, stderr }: { cmd: string; stdout: string; stderr: string }
  ) {
    const msg = [
      e.signal === "SIGTERM" ? `TIMEOUT: ${e.message}` : e.message,
      `stdout: ${stdout}`,
      `stderr: ${stderr}`
    ].join("\n");
    super(msg);

    this.cmd = cmd;
    this.killed = e.killed;
    this.code = e.code;
    this.signal = e.signal;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}
