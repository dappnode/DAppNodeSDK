import { exec, ExecException } from "child_process";

/**
 * If timeout is greater than 0, the parent will send the signal
 * identified by the killSignal property (the default is 'SIGTERM')
 * if the child runs longer than timeout milliseconds.
 */

const defaultTimeout = 3 * 60 * 1000; // ms
const defaultMaxBuffer = 1e7; // bytes

/**
 * Run arbitrary commands in a shell
 * If the child process exits with code > 0, rejects
 * Note: using exec instead of spawn since it's not as safe to run
 * complex arbirary commands. For example:
 * - The executable docker-compose may not be detected, causing ENOENT
 * - Doing cmd > cmd2 may fail
 * - Flags may not be passed properly
 */
export async function shell(
  cmd: string | string[],
  options?: {
    timeout?: number;
    maxBuffer?: number;
    pipeToMain?: boolean;
    onData?: (data: string) => void;
  }
): Promise<string> {
  const {
    timeout = defaultTimeout,
    maxBuffer = defaultMaxBuffer,
    pipeToMain = false,
    onData
  } = options || {};

  return new Promise((resolve, reject): void => {
    const cmdStr = Array.isArray(cmd) ? cmd.join(" ") : cmd;
    const proc = exec(cmdStr, { timeout, maxBuffer }, (err, stdout, stderr) => {
      if (err) {
        // Rethrow a typed error, and ignore the internal NodeJS stack trace
        if (err.signal === "SIGTERM")
          reject(new ShellError(err, `cmd timeout ${timeout}: ${cmd}`));
        else reject(new ShellError(err));
      } else {
        resolve(stdout.trim() || stderr);
      }
    });
    if (pipeToMain) {
      if (proc.stdout) proc.stdout.pipe(process.stdout);
      if (proc.stderr) proc.stderr.pipe(process.stderr);
    }
    if (onData) {
      const onChunkData = (chunk: Buffer): void =>
        onData(chunk.toString().trim());
      if (proc.stdout) proc.stdout.on("data", onChunkData);
      if (proc.stderr) proc.stderr.on("data", onChunkData);
    }
  });
}

/**
 * Typed error implementing the native node child exception error
 * Can be rethrow to ignore the internal NodeJS stack trace
 */
export class ShellError extends Error implements ExecException {
  cmd?: string;
  killed?: boolean;
  code?: number;
  signal?: NodeJS.Signals;
  stdout?: string;
  stderr?: string;
  constructor(
    e: ExecException & { stdout?: string; stderr?: string },
    message?: string
  ) {
    super(message || e.message);
    this.cmd = e.cmd;
    this.killed = e.killed;
    this.code = e.code;
    this.signal = e.signal;
    this.stdout = e.stdout;
    this.stderr = e.stderr;
  }
}
