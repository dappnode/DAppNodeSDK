const execa = require("execa");

/**
 * Custom execa with progress logging
 */
function execaProgress(cmd, { logger = () => {}, ...options } = {}) {
  let stdout = "";
  let stderr = "";

  const process = execa.shell(cmd, options);
  process.stdout.on("data", chunk => {
    const data = chunk.toString().trim();
    stdout += data;
    logger(data);
  });
  process.stderr.on("data", chunk => {
    const data = chunk.toString().trim();
    stderr += data;
    logger(data);
  });

  return new Promise((resolve, reject) => {
    process.on("exit", code => {
      // execa can return null or 0
      if (!code) resolve(stdout);
      else reject(stderr);
    });
  });
}

module.exports = execaProgress;
