const execa = require('execa');

/**
 * If timeout is greater than 0, the parent will send the signal
 * identified by the killSignal property (the default is 'SIGTERM')
 * if the child runs longer than timeout milliseconds.
 */


const defaultTimeout = 3*60*1000; // ms

async function shell(cmd, {silent = false, timeout = deafultTimeout} = {}) {
  const {stdout} = await execa.shell(cmd, {
    stdout: silent ? null : process.stdout,
    stderr: silent ? null : process.stderr,
    stdio: silent ? null : process.stdio,
    timeout,
  });
  return stdout;
}

module.exports = shell;
