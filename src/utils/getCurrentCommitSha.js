const shell = require("./shell");

/**
 * @returns {string} sha = "d51ad2ff51488eaf2bfd5d6906f8b20043ed3b42"
 */
function getCurrentCommitSha() {
  return shell("git rev-parse HEAD", { silent: true });
}

module.exports = getCurrentCommitSha;
