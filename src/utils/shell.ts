import execa from "execa";

/**
 * If timeout is greater than 0, the parent will send the signal
 * identified by the killSignal property (the default is 'SIGTERM')
 * if the child runs longer than timeout milliseconds.
 */

const defaultTimeout = 3 * 60 * 1000; // ms

export async function shell(
  cmd: string,
  options: { silent: boolean; timeout: number }
) {
  const { silent = false, timeout = defaultTimeout } = options || {};
  try {
    const { stdout } = await execa.shell(cmd, {
      stdout: silent ? null : process.stdout,
      stderr: silent ? null : process.stderr,
      timeout
    });
    return stdout;
  } catch (e) {
    if (e.timedOut) e.message = `${e.message} - timed out ${timeout} ms`;
    throw e;
  }
}
