const fs = require("fs");
const path = require("path");
const processExit = require("./processExit");

const defaultCompose = "docker-compose.yml";

function getPathRootCompose(dir) {
  const dirName = dir === "./" ? "root dir" : dir;
  const composeFiles = fs
    .readdirSync(dir)
    .filter(file => file.includes("docker-compose") && file.endsWith(".yml"));

  if (composeFiles.length === 0)
    processExit(`No docker-compose*.yml found in ${dirName}`);
  if (composeFiles.length === 1) return path.join(dir, composeFiles[0]);
  if (composeFiles.includes(defaultCompose))
    return path.join(dir, defaultCompose);

  processExit(
    `There are more than one docker-compose files in ${dirName}`,
    `Please re-name the target compose as ${defaultCompose}.`
  );
}

module.exports = getPathRootCompose;
