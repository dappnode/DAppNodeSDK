const fs = require("fs");
const path = require("path");

function getAssetPath({ required, regex, defaultName, id }, dir) {
  const dirName = dir === "./" ? "root dir" : dir;

  const files = fs.readdirSync(dir);
  const matchingFiles = files.filter(file => regex.test(file));

  if (required && matchingFiles.length === 0)
    throw Error(`No ${id} found in ${dirName}.
${id} naming must match ${regex.toString()}.
Please rename it to ${defaultName}
`);

  if (matchingFiles.length === 1) return path.join(dir, matchingFiles[0]);
  if (matchingFiles.length > 1)
    throw Error(`More than one ${id} found in ${dirName}.
Only one file can match ${regex.toString()}
Please rename it to ${defaultName}      
`);
}

module.exports = getAssetPath;
